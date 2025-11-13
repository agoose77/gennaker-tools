import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import {
  IEditorExtensionRegistry,
  EditorExtensionRegistry
} from '@jupyterlab/codemirror';
import {
  snippetCompletion,
  autocompletion,
  completeFromList
} from '@codemirror/autocomplete';
import type { Completion } from '@codemirror/autocomplete';

const RESTART_RUN_STATELESS = 'gennaker-tools:restart-run-stateless';
const RESET_JUPYTERLAB = 'gennaker-tools:reset-jupyterlab';

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
        console.log(
          `${RESTART_RUN_STATELESS} has been called from... ${orig}.`
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
      command: RESTART_RUN_STATELESS,
      category,
      args: { origin: 'from palette' }
    });
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
    palette.addItem({
      command: RESET_JUPYTERLAB,
      category,
      args: { origin: 'from palette' }
    });
  }
};

const SNIPPETS_PLUGIN_ID = 'gennaker-tools:snippets';
export const snippetsPlugin: JupyterFrontEndPlugin<void> = {
  id: SNIPPETS_PLUGIN_ID,
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [IEditorExtensionRegistry, ISettingRegistry],
  optional: [],
  activate: (
    app: JupyterFrontEnd,
    registry: IEditorExtensionRegistry,
    settings: ISettingRegistry
  ) => {
    console.log('REGISTER SNIPPETS');

    function loadSetting(setting: ISettingRegistry.ISettings): void {
      const snippets = (
        setting.get('snippets').composite as any[] as (Completion & {
          body: string;
        })[]
      ).map(snippet => {
        const { body, ...rest } = snippet;
        return snippetCompletion(body, rest);
      });
      const extension = () => {
        return autocompletion({
          override: [completeFromList(snippets)]
        });
      };
      registry.addExtension(
        Object.freeze({
          name: 'gennaker-tools:snippets',
          factory: () =>
            EditorExtensionRegistry.createConfigurableExtension(() =>
              extension()
            ),
          schema: {}
        })
      );
    }
    // Wait for the application to be restored and
    // for the settings for this plugin to be loaded
    Promise.all([app.restored, settings.load(SNIPPETS_PLUGIN_ID)])
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
  }
};

export default [statelessRunPlugin, reloadPlugin, snippetsPlugin];
