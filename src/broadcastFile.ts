import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IDocumentManager } from '@jupyterlab/docmanager';
import type { Widget } from '@lumino/widgets';

/**
 * Initialization data for the gennaker-tools extension.
 */
const PLUGIN_ID = 'gennaker-tools:broadcast-file';
export const broadcastFilePlugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description: 'A JupyterLab extension for declaring the currently open file.',
  autoStart: true,
  requires: [IDocumentManager],
  optional: [],
  activate: (app: JupyterFrontEnd, docManager: IDocumentManager) => {
    console.log(
      'JupyterLab plugin gennaker-tools:broadcast-file is activated!'
    );
    const { shell } = app;

    const announce = (widget: Widget) => {
      const context = docManager.contextForWidget(widget);
      if (context === undefined) {
        return;
      }
      // Step 1: announce via an event
      const event = new CustomEvent('broadcast-file', {
        detail: context.localPath,
        bubbles: true
      });
      document.body.dispatchEvent(event);

      // Step 2: write to a global location
      (window as any).currentDocumentPath = context.localPath;
    };

    // Listen for changes
    shell.currentChanged!.connect((_, change) => {
      const { newValue } = change;
      if (newValue === null) {
        return;
      }
      // Announce new tab
      announce(newValue);
    });
    if (shell.currentWidget) {
      announce(shell.currentWidget);
    }
  }
};
