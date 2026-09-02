import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, showErrorMessage } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { CommandIDs } from './tokens.js';
import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

/**
 * Initialization data for the gennaker-tools extension.
 */
export const shutdownPlugin: JupyterFrontEndPlugin<void> = {
  id: 'gennaker-tools:shutdown',
  description: 'A JupyterLab extension to shutdown without confirmation.',
  autoStart: true,
  requires: [ICommandPalette],
  optional: [ITranslator],
  activate: async (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    translator: ITranslator | null
  ) => {
    console.log('JupyterLab plugin gennaker-tools:shutdown is activated!');

    const { commands } = app;
    const trans = (translator ?? nullTranslator).load('jupyterlab');

    const setting = app.serviceManager.serverSettings;
    const apiURL = URLExt.join(setting.baseUrl, 'api/shutdown');

    commands.addCommand(CommandIDs.shutdown, {
      label: trans.__('Force Shut Down'),
      caption: trans.__('Force Shut Down'),
      isEnabled: () => true,
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
      execute: async (args: any) => {
        // Shutdown all kernel and terminal sessions before shutting down the server
        // If this fails, we continue execution so we can post an api/shutdown request
        try {
          await Promise.all([
            app.serviceManager.sessions.shutdownAll(),
            app.serviceManager.terminals.shutdownAll()
          ]);
        } catch (e) {
          // Do nothing
          console.log(`Failed to shutdown sessions and terminals: ${e}`);
        }

        return ServerConnection.makeRequest(apiURL, { method: 'POST' }, setting)
          .then(result => {
            if (result.ok) {
              showErrorMessage(
                'JupyterLab is shut down.',
                'JupyterLab has shut down. Please close this window.'
              );
              window.close();
            } else {
              throw new ServerConnection.ResponseError(result);
            }
          })
          .catch(data => {
            throw new ServerConnection.NetworkError(data);
          });
      }
    });

    const category = trans.__('File');
    palette.addItem({
      command: CommandIDs.shutdown,
      category,
      args: { origin: 'from palette' }
    });
  }
};
