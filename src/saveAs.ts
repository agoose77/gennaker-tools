import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { showDialog, Dialog } from '@jupyterlab/apputils';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import { Widget } from '@lumino/widgets';
import { IDocumentManager } from '@jupyterlab/docmanager';
import type { DocumentRegistry } from '@jupyterlab/docregistry';
import { IContentsManager, Contents } from '@jupyterlab/services';

/**
 * Create the node for a save widget.
 */
function createSaveNode(path: string): HTMLElement {
  const input = document.createElement('input');
  input.value = path;
  return input;
}

namespace Private {
  /**
   * Initialization data for the gennaker-tools extension.
   */
  class SaveWidget extends Widget {
    /**
     * Construct a new save widget.
     */
    constructor(path: string) {
      super({ node: createSaveNode(path) });
    }

    /**
     * Get the value for the widget.
     */
    getValue(): string {
      return (this.node as HTMLInputElement).value;
    }
  }

  export async function getSavePath(
    trans: TranslationBundle,
    localPath: string
  ): Promise<string | undefined> {
    const saveBtn = Dialog.okButton({
      label: trans.__('Save'),
      accept: true
    });
    const result = await showDialog({
      title: trans.__('Save File As…'),
      body: new SaveWidget(localPath),
      buttons: [Dialog.cancelButton(), saveBtn]
    });
    if (result.button.accept) {
      return result.value ?? undefined;
    }
    return;
  }

  /**
   * Vendors https://github.com/jupyterlab/jupyterlab/blob/c56dc89e73db208515710e01ec42baf8f26fe2e2/packages/docregistry/src/context.ts#L308-L333
   * into our codebase, so we can patch it and use it.
   */
  export async function vendoredSaveAs(
    contents: Contents.IManager,
    context: DocumentRegistry.Context,
    newPath: string
  ) {
    // Make sure the path does not exist.
    try {
      await contents.get(newPath, {
        contentProviderId: (context as any)._contentProviderId,
        content: false
      });
      await (context as any)._maybeOverWrite(newPath);
    } catch (err: any) {
      if (!err.response || err.response.status !== 404) {
        // Dialog rejection (user cancelled)
        if (!err.response) {
          return false;
        }
        throw err;
      }
    }
    await (context as any)._finishSaveAs(newPath);
  }
}

export const saveAsPlugin: JupyterFrontEndPlugin<void> = {
  id: 'gennaker-tools:save-as',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [IDocumentManager, IContentsManager],
  optional: [ITranslator],
  activate: (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    contents: Contents.IManager,
    translator: ITranslator | null
  ) => {
    const trans = (translator ?? nullTranslator).load('jupyterlab');
    const { commands, shell } = app;

    console.log('JupyterLab plugin gennaker-tools:save-as is activated!');

    commands.addCommand('gennaker-tools:save-as', {
      label: () => 'Save As',
      caption: 'Save with new path',
      isEnabled: () => true,
      describedBy: {
        args: {
          type: 'object',
          properties: {}
        }
      },
      execute: async () => {
        const context = docManager.contextForWidget(shell.currentWidget!)!;
        const localPath = contents.localPath(context.path);
        const newLocalPath = await Private.getSavePath(trans, localPath);

        const drive = contents.driveName(context.path);
        const newPath =
          drive === '' ? newLocalPath : `${drive}:${newLocalPath}`;
        if (!newPath) {
          return;
        }

        if (newPath === context.path) {
          await context.save();
          return;
        }

        // FIXME: Hacky! JupyterLab expects to be able to break this API, because
        //        it's private.
        // Call JupyterLab's internal implementation
        Private.vendoredSaveAs(contents, context, newPath);
      }
    });
  }
};
