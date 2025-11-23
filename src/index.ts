import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
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

type SnippetConfigurationItem = Completion & { body: string };
type SnippetConfiguration = {
  snippets: SnippetConfigurationItem[];
};

const SNIPPET_EXTENSION_SCHEMA = {
  properties: {
    snippets: {
      type: 'array',
      title: 'Codemirror snippets',
      description:
        'Snippets of the form accepted by Codemirrors snippetCompletion',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'class',
              'constant',
              'enum',
              'function',
              'interface',
              'keyword',
              'method',
              'namespace',
              'property',
              'text',
              'type',
              'variable'
            ]
          },

          body: { type: 'string' },
          label: { type: 'string' }
        },
        required: ['type', 'body', 'label']
      }
    }
  },
  additionalProperties: false,
  type: 'object'
};

const SNIPPETS_PLUGIN_ID = 'gennaker-tools:snippets';
export const snippetsPlugin: JupyterFrontEndPlugin<void> = {
  id: SNIPPETS_PLUGIN_ID,
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [IEditorExtensionRegistry],
  optional: [],
  activate: (app: JupyterFrontEnd, registry: IEditorExtensionRegistry) => {
    registry.addExtension(
      Object.freeze({
        name: 'gennaker-tools:snippets',
        factory: () =>
          EditorExtensionRegistry.createConfigurableExtension(
            (config: SnippetConfiguration) => {
              return autocompletion({
                override: [
                  completeFromList(
                    config.snippets.map(snippet => {
                      const { body, ...rest } = snippet;
                      return snippetCompletion(body, rest);
                    })
                  )
                ]
              });
            }
          ),
        default: { snippets: [] },
        schema: SNIPPET_EXTENSION_SCHEMA
      })
    );
  }
};

export default [statelessRunPlugin, reloadPlugin, snippetsPlugin];
