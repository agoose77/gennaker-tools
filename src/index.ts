import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

const RESTART_RUN_STATELESS = "gennaker-tools:restart-run-stateless";
const RESET_JUPYTERLAB = "gennaker-tools:reset-jupyterlab";    

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

    console.log('JupyterLab extension gennaker-tools is activated!');
    // Add a command

    const isEnabled = () => {
      console.log('enabed', { tracker, shell });
      return (
        tracker.currentWidget !== null &&
        tracker.currentWidget === shell.currentWidget
      );
    };

    commands.addCommand(RESTART_RUN_STATELESS, {
      label: 'Restart Kernel, Clear Outputs, and Run All Above Selected Cell',
      caption:
        'Clear all outputs, restart kernel, and run all cells above the selected cell',
      isEnabled,
      execute: async (args: any) => {
        const orig = args['origin'];
        console.log(`${RESTART_RUN_STATELESS} has been called from... ${orig}.`);
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
    palette.addItem({ command: RESTART_RUN_STATELESS, category, args: { origin: 'from palette' } });
  }
};


/**
 * Initialization data for the gennaker-tools extension.
 */
export const reloadPlugin: JupyterFrontEndPlugin<void> = {
  id: 'gennaker-tools:reload',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [ICommandPalette],
  optional: [ITranslator],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    translator: ITranslator | null
  ) => {
      const { commands } = app;
      const trans = (translator ?? nullTranslator).load('jupyterlab');
      
      commands.addCommand(RESET_JUPYTERLAB, {
          label: 'Reset JupyterLab',
          caption: 'Reset JupyterLab',
          isEnabled: () => true,
          execute: (args: any) => {
            const orig = args['origin'];
            if (orig !== 'init') {
              window.location.reload();
            }
          }
        });

    // Add the command to the command palette
    const category = trans.__('Reset');
    palette.addItem({ command: RESET_JUPYTERLAB, category, args: { origin: 'from palette' } });
  }
};

export default [ statelessRunPlugin, reloadPlugin ];
