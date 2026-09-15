import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Widget } from '@lumino/widgets';

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
  activate: async (app: JupyterFrontEnd, docManager: IDocumentManager) => {
    console.log(
      'JupyterLab plugin gennaker-tools:broadcast-file is activated!'
    );
    const { shell } = app;


    const announce = (context: DocumentRegistry.Context) => {
      const source = context.model.sharedModel.getSource();
      const documentInfo = {
        source,
        path: context.localPath,
        timestamp: Date.now()
      }

      // Step 1: announce via an event
      const event = new CustomEvent('broadcast-file', {
        detail: documentInfo,
        bubbles: true
      });
      document.body.dispatchEvent(event);

      // Step 2: write to a global location
      (window as any).currentDocumentInfo = documentInfo;
    };


    // Handle registration of event listeners
    // We rely on the `this` binding feature of JavaScript 
    // so that we do not need to keep around a registry of `slot` functions 
    // for each context. Instead, we pass in "the same" `slot`, and the 
    // individual (changing) context that we already have access to.
    function slot(this: DocumentRegistry.Context) {
      announce(this)
    }

    /**
     * Listen for model updates, and broadcast the changes using announce()
     */
    const registerAndAnnounceChanges = async (widget: Widget) => {
      const context = docManager.contextForWidget(widget);
      if (context === undefined) {
        return;
      }
      // Wait until we have source value
      await context.ready;

      // Announce initial state
      announce(context);

      // Listen for future changes
      context.model.sharedModel.changed.connect(slot, context)
    }

    // Listen for changes
    shell.currentChanged!.connect(async (_, change) => {
      const { oldValue, newValue } = change;

      // Add listeners and announce state
      if (newValue !== null) {
        await registerAndAnnounceChanges(newValue);
      }

      // Disconnect from previous listeners
      if (oldValue != null) {
        const oldContext = docManager.contextForWidget(oldValue);
        if (oldContext === undefined) {
          return;
        }
        oldContext.model.sharedModel.changed.disconnect(slot, oldContext);
      }
    });

    // Announce initial tab
    if (shell.currentWidget) {
      await registerAndAnnounceChanges(shell.currentWidget);
    }
  }
};
