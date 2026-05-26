import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { showDialog, Dialog } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { Widget } from '@lumino/widgets';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IContentsManager } from '@jupyterlab/services';
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

  /**
   * Create the node for a save widget.
   */
  function createSaveNode(path: string): HTMLElement {
    const input = document.createElement('input');
    input.value = path;
    return input;
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
    contents: IContentsManager,
    translator: ITranslator | null
  ) => {
    const trans = (translator ?? nullTranslator).load('jupyterlab');
    const { commands, shell } = app;

    console.log('JupyterLab plugin gennaker-tools:save-as is activated!');
    // Add a command

    // TODO: move to another location
        commands.addCommand('gennaker-tools:save-as', {
        label: () =>
        "Save as",
        caption: 'Save with new path',
        isEnabled: () => true,
        describedBy: {
        args: {
            type: 'object',
            properties: {}
        }
        },
        execute: () => {
            const context = docManager.contextForWidget(shell.currentWidget!);
            const localPath = docManager.contents.localPath(context.path);
            console.log("testing new save as")
            const saveBtn = Dialog.okButton({ label: trans.__('Save'), accept: true });
            return showDialog({
            title: trans.__('Save File As…'),
            body: new SaveWidget("test_path"),
            buttons: [Dialog.cancelButton(), saveBtn]
            }).then(result => {
            if (result.button.accept) {
                return result.value ?? undefined;
            }
            return;
            });
        }
    })
  }
};
