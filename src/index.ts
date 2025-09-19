import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

/**
 * Initialization data for the gennaker-tools extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'gennaker-tools:plugin',
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
    const command = 'stateless:clear-restart-run-to-selected';

    console.log('JupyterLab extension gennaker-tools is activated!');
    // Add a command

    const isEnabled = () => {
      console.log('enabed', { tracker, shell });
      return (
        tracker.currentWidget !== null &&
        tracker.currentWidget === shell.currentWidget
      );
    };

    commands.addCommand(command, {
      label: 'Restart Kernel, Clear Outputs, and Run All Above Selected Cell',
      caption:
        'Clear all outputs, restart kernel, and run all cells above the selected cell',
      isEnabled,
      execute: async (args: any) => {
        const orig = args['origin'];
        console.log(`${command} has been called from... ${orig}.`);
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
    palette.addItem({ command, category, args: { origin: 'from palette' } });
  }
};

export default plugin;
