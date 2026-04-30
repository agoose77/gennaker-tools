import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
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
import Ajv from 'ajv';

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

function validateSnippetConfig(config: SnippetConfiguration) {
  const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

  const validate = ajv.compile(SNIPPET_EXTENSION_SCHEMA);

  if (validate(config)) {
    return config;
  } else {
    console.error('The editor snippet config was not valid!');
    for (const error of validate.errors!) {
      console.error(`${error.instancePath}: ${error.message}`);
    }
    return {
      snippets: []
    };
  }
}

const SNIPPETS_PLUGIN_ID = 'gennaker-tools:snippets';
export const snippetsPlugin: JupyterFrontEndPlugin<void> = {
  id: SNIPPETS_PLUGIN_ID,
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [IEditorExtensionRegistry],
  optional: [],
  activate: (app: JupyterFrontEnd, registry: IEditorExtensionRegistry) => {
    console.log('JupyterLab plugin gennaker-tools:snippets is activated!');
    registry.addExtension(
      Object.freeze({
        name: 'gennaker-tools:snippets',
        factory: () =>
          EditorExtensionRegistry.createConfigurableExtension(
            (config: SnippetConfiguration) => {
              config = validateSnippetConfig(config);

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
