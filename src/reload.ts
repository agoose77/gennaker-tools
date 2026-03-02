import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { CommandIDs } from './tokens.js';

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
    console.log('JupyterLab plugin gennaker-tools:reload is activated!');

    const { commands } = app;
    const trans = (translator ?? nullTranslator).load('jupyterlab');

    commands.addCommand(CommandIDs.resetJupyterLab, {
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
      command: CommandIDs.resetJupyterLab,
      category,
      args: { origin: 'from palette' }
    });
  }
};
