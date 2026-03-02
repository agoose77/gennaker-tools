import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { showDialog, Dialog } from '@jupyterlab/apputils';
import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
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
    console.log(`Data received from ${END_POINT}:`, data);
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
export const settingsChangedPlugin: JupyterFrontEndPlugin<void> = {
  id: 'gennaker-tools:settings-changed',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [],
  activate: (app: JupyterFrontEnd) => {
    console.log(
      'JupyterLab plugin gennaker-tools:settings-changed is activated!'
    );

    const { commands } = app;
    const serverSettings = app.serviceManager.serverSettings;

    const ws = createWebSocket(serverSettings);
    console.log({ ws });
    ws.onmessage = event => {
      const data = JSON.parse(event.data);
      if (data.file_type !== 'toml') {
        // We don't care about JSON-to-TOML sync — TOML files aren't read by JupyterLab
        return;
      }

      showDialog({
        title: 'Settings file change changed',
        body: `A change was detected to ${data.file_path}. This might require a reload of JupyterLab. Reloading will lose any unsaved changes on your page.`,
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
    };
  }
};
