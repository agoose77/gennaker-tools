import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ICommandPalette } from '@jupyterlab/apputils';
/**
 * Initialization data for the juptyerlab-stateless-run extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'juptyerlab-stateless-run:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [ICommandPalette, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    tracker: INotebookTracker
  ) => {
    const { commands, shell } = app;
    const command = 'paul:clear-run-to-selected';

    console.log('JupyterLab extension juptyerlab-stateless-run is activated!');
    // Add a command
    commands.addCommand(command, {
      label: 'Clear All Outputs, Restart Kernel, and Run to Selected',
      caption: 'Clear all outputs, restart kernel, and run to selected',
      isEnabled: () => {
        return (
          tracker.currentWidget !== null &&
          tracker.currentWidget === shell.currentWidget
        );
      },
      execute: async (args: any) => {
        const orig = args['origin'];
        console.log(`${command} has been called from... ${orig}.`);
        if (orig !== 'init') {
          // Clear all outputs
          await commands
            .execute('notebook:clear-all-cell-outputs', { origin: 'init' })
            .catch(reason => {
              console.error(
                `An error occurred during the execution of ${command}.\n${reason}`
              );
            });
          // Clear all outputs
          await commands
            .execute('notebook:restart-and-run-to-selected', { origin: 'init' })
            .catch(reason => {
              console.error(
                `An error occurred during the execution of ${command}.\n${reason}`
              );
            });
        }
      }
    });

    // Add the command to the command palette
    const category = 'Extension Examples';
    palette.addItem({ command, category, args: { origin: 'from palette' } });
  }
};

export default plugin;
