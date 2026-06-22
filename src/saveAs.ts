import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { showDialog, Dialog } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { Widget } from '@lumino/widgets';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IContentsManager } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import type { Contents } from '@jupyterlab/services';
import type { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import type { DocumentRegistry } from '@jupyterlab/docregistry';

namespace Private {
  /**
   * Initialization data for the gennaker-tools extension.
   */
  class SaveWidget extends Widget {
    /**
     * Construct a new save widget.
     */
    constructor(path: string) {
      /**
       * Create the node for a save widget.
       */
      const createSaveNode = (path: string) => {
        const input = document.createElement('input');
        input.value = path;
        return input;
      };
      super({ node: createSaveNode(path) });
    }

    /**
     * Get the value for the widget.
     */
    getValue(): string {
      return (this.node as HTMLInputElement).value;
    }
  }

  /**
   * Export this helper into saveAs (but not outside of saveAs) so that we can use it elsewhere
   */
  export async function saveAsDialog(
    trans: IRenderMime.TranslationBundle,
    destinationPath: string
  ) {
    const saveBtn = Dialog.okButton({ label: trans.__('Save'), accept: true });

    const result = await showDialog({
      title: trans.__('Save File As…'),
      // prompt save as dialog with destination path (want to add custom message)
      body: new SaveWidget(destinationPath),
      buttons: [Dialog.cancelButton(), saveBtn]
    });
    if (result.button.accept) {
      return result.value ?? undefined;
    } else {
      return;
    }
  }

  /** Returns the file type for a widget.
   *
   * Vendored from https://github.com/jupyterlab/jupyterlab/blob/c56dc89e73db208515710e01ec42baf8f26fe2e2/packages/docmanager-extension/src/index.tsx#L683
   */
  export function fileType(
    widget: Widget | null,
    docManager: IDocumentManager
  ): string {
    if (!widget) {
      return 'File';
    }
    const context = docManager.contextForWidget(widget);
    if (!context) {
      return '';
    }
    const fts = docManager.registry.getFileTypesForPath(context.path);
    return fts.length && fts[0].displayName ? fts[0].displayName : 'File';
  }

  /**
   * Implement save-as finaliser
   *
   * Vendored from https://github.com/jupyterlab/jupyterlab/blob/main/packages/docregistry/src/context.ts
   */
  export async function saveAs(
    contents: Contents.IManager,
    newPath: string,
    context: DocumentRegistry.Context
  ) {
    try {
      await contents.get(newPath, {
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

  export async function ensureDirectoryExists(
    contents: Contents.IManager,
    path: string
  ) {
    // Let's ensure that the writable path exists!
    try {
      await contents.get(path, {
        content: false,
        type: 'directory'
      });
    } catch (err: any) {
      // Error during fetching
      if (!err.response || err.response.status !== 404) {
        throw err;
      }
      const newModel = await contents.newUntitled({ type: 'directory' });
      await contents.rename(newModel.path, path);
    }
  }
}

const PLUGIN_ID = 'gennaker-tools:save-as';

export const saveAsPlugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [IDocumentManager, IContentsManager, ISettingRegistry],
  optional: [ITranslator],
  activate: (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    contents: Contents.IManager,
    settings: ISettingRegistry,
    translator: ITranslator | null
  ) => {
    const trans = (translator ?? nullTranslator).load('jupyterlab');
    const { commands, shell } = app;

    console.log('JupyterLab plugin gennaker-tools:save-as is activated!');

    // Setting for writable folder
    // This should be a path like /foo/nar, or empty string "" meaning not-set
    let writablePath = '';

    /**
     * Implement the handler for settings changes
     *
     * @param setting Extension settings
     */
    const loadSetting = (setting: ISettingRegistry.ISettings) => {
      // Read the settings and convert to the correct type
      writablePath = setting.get('writablePath').composite as string;
    };

    // Wait for the application to be restored and
    // for the settings for this plugin to be loaded
    Promise.all([app.restored, settings.load(PLUGIN_ID)])
      .then(([, setting]) => {
        // Read the settings
        loadSetting(setting);

        // Listen for your plugin setting changes using Signal
        setting.changed.connect(loadSetting);
      })
      .catch(reason => {
        console.error(
          `Something went wrong when reading the settings.\n${reason}`
        );
      });

    const isEnabled = () => {
      const { currentWidget } = shell;
      return !!(currentWidget && docManager.contextForWidget(currentWidget));
    };

    commands.addCommand('gennaker-tools:save-as', {
      label: () =>
        trans.__(
          'Save %1 As…',
          Private.fileType(shell.currentWidget, docManager)
        ),
      caption: 'Save with new path',
      isEnabled,
      describedBy: {
        args: {
          type: 'object',
          properties: {}
        }
      },
      execute: async () => {
        // Checks that shell.currentWidget is valid:
        if (!isEnabled()) {
          return;
        }

        // We need a "context" in order to save
        const context = docManager.contextForWidget(shell.currentWidget!);
        if (!context) {
          return showDialog({
            title: trans.__('Cannot Save'),
            body: trans.__('No context found for current widget!'),
            buttons: [Dialog.okButton()]
          });
        }

        console.log('testing gennaker-tools:save-as');

        /**
         * Build proper drive-aware path
         * Useful when speaking to contents manager
         */
        const drive = contents.driveName(context.path);
        const makeContentsPath = (path: string) =>
          drive === '' ? path : `${drive}:${path}`;

        // get local path of current file
        const localPath = context.localPath;

        // get parent of current file
        const pathParts = localPath.split('/').slice(0, -1);
        const directoryPath = pathParts.join('/');

        // Only if we can write the file to the directory
        let writable = true;
        try {
          // Check to see if path exists
          const contentsResult = await contents.get(
            makeContentsPath(directoryPath),
            { content: false, type: 'directory' }
          );

          // If it's not writable, set the flag.
          if (!contentsResult.writable) {
            writable = false;
          }
        } catch (err: any) {
          // Unexpected error during fetching, throw
          if (!err.response || err.response.status !== 404) {
            throw err;
          }
          // Expected (possible) 404 means file not found
          // Let's ignore this and allow JupyterLab to handle it.
        }

        let destinationPath: string;
        // If writable, destination remains the same
        if (writable) {
          destinationPath = localPath;
        }
        // Otherwise, write to the writablePath
        else {
          // Let's be sure we can write here!
          await Private.ensureDirectoryExists(
            contents,
            makeContentsPath(writablePath)
          );

          // Now we write here!
          const fileName = localPath.split('/').pop();
          destinationPath = [writablePath, fileName].join('/');
        }

        // Launch the save-as dialog
        const savePath = await Private.saveAsDialog(trans, destinationPath);
        if (savePath === undefined) {
          return;
        }

        // Is this just a regular save?
        const newPath = makeContentsPath(savePath);
        if (newPath === context.path) {
          await context.save();
          return;
        }
        // NOTE: this was vendored from JupyterLab in order to customise the saveAs function!
        //       this may break in future! :(
        await Private.saveAs(contents, newPath, context);
      }
    });
  }
};
