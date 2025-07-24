import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';
/**
 * Initialization data for the myextension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'myextension:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [ICommandPalette],
  activate: (app: JupyterFrontEnd, palette: ICommandPalette) => {

    const { commands } = app;
    const command = 'paul:clear-run-to-selected';

    console.log('JupyterLab extension myextension is activated!');
    // Add a command
    commands.addCommand(command, {
      label: 'Clear All Outputs, Restart Kernel, and Run to Selected',
      caption: 'Clear all outputs, restart kernel, and run to selected',

      execute: async (args: any) => {
        const orig = args['origin'];
        console.log(`${command} has been called from ${orig}.`);
        if (orig !== 'init') {

          // Clear all outputs
          await commands.execute("notebook:clear-all-cell-outputs", { origin: 'init' }).catch(reason => {
            console.error(
               `An error occurred during the execution of ${command}.\n${reason}`
           );
          });
          // Clear all outputs
          await commands.execute("notebook:restart-and-run-to-selected", { origin: 'init' }).catch(reason => {
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
