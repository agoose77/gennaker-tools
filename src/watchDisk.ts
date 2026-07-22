import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { showDialog, Dialog } from '@jupyterlab/apputils';
//import { URLExt } from '@jupyterlab/coreutils';
//import { ServerConnection } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
//import { CommandIDs } from './tokens.js';
import { ILabShell } from '@jupyterlab/application';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IContentsManager } from '@jupyterlab/services';
import type { Contents } from '@jupyterlab/services';

/**
 * Initialization data for the gennaker-tools extension.
 */
const PLUGIN_ID = 'gennaker-tools:watch-disk';
export const watchDiskPlugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description:
    'A JupyterLab extension for watching edits to open files saved on disk.',
  autoStart: true,
  requires: [ISettingRegistry, ILabShell, IDocumentManager, IContentsManager],
  activate: (
    app: JupyterFrontEnd,
    settings: ISettingRegistry,
    labShell: ILabShell,
    docManager: IDocumentManager,
    contents: Contents.IManager
  ) => {
    console.log('JupyterLab plugin gennaker-tools:watch-disk is activated!');

    const { commands } = app;

    // Setting for auto reload

    let autoReload = true;
    let reloadInterval = 1000;

    /**
     * Implement the handler for settings changes
     *
     * @param setting Extension settings
     */
    const loadSetting = (setting: ISettingRegistry.ISettings) => {
      // Read the settings and convert to the correct type
      autoReload = setting.get('autoReload').composite as boolean;
      reloadInterval = setting.get('reloadInterval').composite as number;
    };

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

    const knownTimestamps = new Map<string, string>();

    const loop = async () => {
      try {
        /* get open files in jupyter lab environment (open tabs)*/
        /* for each open file, find the time of last modified for the client version and the disk version */
        for (const widget of labShell.widgets('main')) {
          const context = docManager.contextForWidget(widget);
          if (context === undefined) {
            console.warn(`No context for widget: ${widget.title}`);
            continue;
          }

          const isDirty = context.model.dirty;

          const jlModel = context.contentsModel;
          if (jlModel === null) {
            console.warn(`No model for context: ${context.path}`);
            continue;
          }

          const diskModel = await contents.get(context.path, {
            content: false
          });

          /* open in VSCode and change file and save, then refresh in jupyter lab and see the different last modified times */

          const jlModifiedTime = new Date(jlModel.last_modified);
          const diskModifiedTime = new Date(diskModel.last_modified);

          const timeDiff =
            diskModifiedTime.getTime() - jlModifiedTime.getTime();
          const diffTolerance = 500;

          // if the difference between the disk model and jupyter lab model is the same (or within the tolerance)
          // then do not do anything
          // (there are no untracked changes on disk)
          if (timeDiff <= diffTolerance) {
            console.debug('No changes detected on disk');
            continue;
          }

          // get the last saved timestamp for the given file (that the user is aware of)
          // if the file has not been updated since the last timestamp, do nothing
          const knownTime = knownTimestamps.get(context.path);
          if (knownTime === diskModel.last_modified) {
            continue;
          }

          // set the timestamp for the file as current time
          knownTimestamps.set(context.path, diskModel.last_modified);

          if (autoReload && !isDirty) {
            await commands.execute('docmanager:reload');
          } else {
            const message =
              'A change to the file on disk has been made externally. Refresh to load change. Note that all unsaved work will be overwritten.';
            const result = await showDialog({
              title: 'File changed externally',
              body: message,
              buttons: [
                Dialog.cancelButton({ label: 'Ignore' }),
                Dialog.okButton({ label: 'Reload' })
              ],
              defaultButton: 0
            });
            if (result.button.accept) {
              await commands.execute('docmanager:reload');
            } else {
              return;
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setTimeout(loop, reloadInterval);
      }
    };
    loop();
  }
};
