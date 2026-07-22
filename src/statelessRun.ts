import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { CommandIDs } from './tokens.js';
/**
 * Initialization data for the gennaker-tools extension.
 */
export const statelessRunPlugin: JupyterFrontEndPlugin<void> = {
  id: 'gennaker-tools:stateless-run',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [ICommandPalette, INotebookTracker],
  optional: [ITranslator],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    tracker: INotebookTracker,
    translator: ITranslator | null
  ) => {
    const trans = (translator ?? nullTranslator).load('jupyterlab');
    const { commands, shell } = app;

    console.log('JupyterLab plugin gennaker-tools:stateless-run is activated!');
    // Add a command

    const isEnabled = () => {
      return (
        tracker.currentWidget !== null &&
        tracker.currentWidget === shell.currentWidget
      );
    };

    commands.addCommand(CommandIDs.restartRunStateless, {
      label: trans.__(
        'Restart Kernel, Clear Outputs, and Run All Above Selected Cell'
      ),
      caption: trans.__(
        'Clear all outputs, restart kernel, and run all cells above the selected cell'
      ),
      describedBy: {
        args: {
          type: 'object',
          properties: {
            origin: {
              type: 'string'
            }
          }
        }
      },
      isEnabled,
      execute: async (args: any) => {
        const orig = args['origin'];
        console.log(
          `${CommandIDs.restartRunStateless} has been called from... ${orig}.`
        );
        if (orig !== 'init') {
          // Clear all outputs
          await commands.execute('apputils:run-all-enabled', {
            commands: [
              'notebook:clear-all-cell-outputs',
              'notebook:restart-and-run-to-selected'
            ]
          });
        }
      }
    });

    // Add the command to the command palette
    const category = trans.__('Notebook Operations');
    palette.addItem({
      command: CommandIDs.restartRunStateless,
      category,
      args: { origin: 'from palette' }
    });
  }
};
