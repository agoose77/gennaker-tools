import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { showDialog, Dialog, Notification } from '@jupyterlab/apputils';
import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { CommandIDs } from './tokens.js';

const NAMESPACE = 'gennaker-tools';
const END_POINT = 'settings-changed';

function createWebSocket(serverSettings: ServerConnection.ISettings) {
  // Make request to Jupyter API
  const settings = serverSettings ?? ServerConnection.makeSettings();
  const wsUrl = URLExt.join(
    settings.baseUrl.replace(/^http/, 'ws'),
    NAMESPACE, // API Namespace
    END_POINT
  );

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log(`WebSocket connected to ${END_POINT}`);
    ws.send(JSON.stringify({ message: 'Client connected' }));
  };

  ws.onmessage = event => {
    const data = JSON.parse(event.data);
    console.debug(`Data received from ${END_POINT}:`, data);
  };

  ws.onerror = error => {
    console.error(`WebSocket error on ${END_POINT}:`, error);
  };

  ws.onclose = () => {
    console.log(`WebSocket disconnected from ${END_POINT}`);
  };

  return ws;
}

/**
 * Initialization data for the gennaker-tools extension.
 */
const PLUGIN_ID = 'gennaker-tools:toml-sync';
export const tomlSyncPlugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description:
    'A JupyterLab extension for synchronising TOML files with JupyterLab settings.',
  autoStart: true,
  requires: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settings: ISettingRegistry) => {
    console.log('JupyterLab plugin gennaker-tools:toml-sync is activated!');

    const { commands } = app;
    const serverSettings = app.serviceManager.serverSettings;

    let enabled = true;
    let style = 'notification';
    /**
     * Load the settings for this extension
     *
     * @param setting Extension settings
     */
    function loadSetting(setting: ISettingRegistry.ISettings): void {
      // Read the settings and convert to the correct type
      enabled = setting.get('enabled').composite as boolean;
      style = setting.get('style').composite as string;
    }

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

    const ws = createWebSocket(serverSettings);
    ws.onmessage = event => {
      console.log(event);
      // const data = JSON.parse(event.data);
      if (!enabled) {
        console.debug('Notifications are disabled for settings sync');
        return;
      }
      const message =
        'A change was detected to a settings file. This might require a reload of JupyterLab. Reloading will lose any unsaved changes on your page.';
      switch (style) {
        case 'notification': {
          Notification.warning(message, {
            actions: [
              {
                label: 'Reload',
                callback: () => commands.execute(CommandIDs.resetJupyterLab)
              },
              {
                label: 'Ignore',
                callback: () => undefined
              }
            ],
            autoClose: 3000
          });
          break;
        }
        case 'alert': {
          showDialog({
            title: 'Settings file change changed',
            body: message,
            buttons: [
              Dialog.cancelButton({ label: 'Ignore' }),
              Dialog.okButton({ label: 'Reload' })
            ],
            defaultButton: 0
          })
            .catch(e => console.log(e))
            .then(async result => {
              console.log({ result });
              if (result?.button.accept) {
                await commands.execute(CommandIDs.resetJupyterLab);
              }
            });
          break;
        }
        default: {
          throw new Error(`Unknown style ${style}`);
        }
      }
    };
  }
};
