import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { showDialog, Dialog } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { Widget } from '@lumino/widgets';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IContentsManager } from '@jupyterlab/services';
import type { Contents } from '@jupyterlab/services';
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
    contents: Contents.IManager,
    translator: ITranslator | null
  ) => {
    const trans = (translator ?? nullTranslator).load('jupyterlab');
    const { commands, shell } = app;

    console.log('JupyterLab plugin gennaker-tools:save-as is activated!');
    // Add a command

    // TODO: move to another location
        commands.addCommand('gennaker-tools:save-as', {
        label: () =>
        "Save As",
        caption: 'Save with new path',
        isEnabled: () => true,
        describedBy: {
        args: {
            type: 'object',
            properties: {}
        }
        },
        execute: async () => {

          // get context of current file
          const context = docManager.contextForWidget(shell.currentWidget!);
          if (context === undefined) {
            return;
          }

          // get local path of current file
          const localPath = context.localPath;
          const factory = 


          // get parent of current file
          const pathParts = localPath.split('/').slice(0, -1);
          const directoryPath = pathParts.join('/');

          let destinationPath: string; 

          // check to see if parent is writable
          const contentsResult = await contents.get(directoryPath);
          const writable = contentsResult.writable;

          // if writable, save as destination remains the same
          if (writable) {
            destinationPath = localPath;
          }

          // if read only, write destination is the designated folder 
          // FIXME: can define desired folder in config file
          else {
            const fileName = localPath.split('/').pop();
            destinationPath = [...pathParts.slice(0, -1), "test_folder", fileName].join('/');
          }
        
          console.log("testing new save as")
          const saveBtn = Dialog.okButton({ label: trans.__('Save'), accept: true });

          const savePath = await showDialog({
            title: trans.__('Save File As…'),
            // prompt save as dialog with destination path (want to add custom message)
            body: new SaveWidget(destinationPath),
            buttons: [Dialog.cancelButton(), saveBtn]
            }).then(result => {
            if (result.button.accept) {
                return result.value ?? undefined;
            }
            return;
          });

          if (savePath === undefined) {
            return;
          }

          const drive = contents.driveName(context.path);
          const newPath = drive == '' ? savePath : `${drive}:${savePath}`;

          if (newPath === context.path) {
            await context.save();
            return;
          }

          const maybeOverWrite = async (path: string) => {
            const body = trans.__(
              '"%1" already exists. Do you want to replace it?',
              path
            );
            const overwriteBtn = Dialog.warnButton({
              label: trans.__('Overwrite'),
              accept: true
            });
            return showDialog({
              title: trans.__('File Overwrite?'),
              body,
              buttons: [Dialog.cancelButton(), overwriteBtn]
            }).then(result => {
              if (result.button.accept) {
                return contents.delete(path).then(() => {
                  const model = context.model;
                  const options = (
                    
                  )
                  return contents.save(path, options);
                });
              } else {
                return Promise.reject(new Error('Cancelled'));
              }
            });
          }

          // Make sure the path does not exist.
          try {
            // await docManager.ready;
            await contents.get(newPath, {
              content: false
            });
            await maybeOverWrite(newPath);
          } catch (err) {
            if (!err.response || err.response.status !== 404) {
              // Dialog rejection (user cancelled)
              if (!err.response) {
                return false;
              }
              throw err;
            }
          }
          await this._finishSaveAs(newPath);
          
        }
    })
  }
};
