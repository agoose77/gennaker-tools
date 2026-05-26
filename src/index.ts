import { snippetsPlugin } from './snippets.js';
import { reloadPlugin } from './reload.js';
import { statelessRunPlugin } from './statelessRun.js';
import { tomlSyncPlugin } from './tomlSync.js';
import { saveAsPlugin } from './saveAs.js';

export { snippetsPlugin, statelessRunPlugin, reloadPlugin, tomlSyncPlugin, saveAsPlugin };
export default [
  statelessRunPlugin,
  reloadPlugin,
  snippetsPlugin,
  tomlSyncPlugin,
  saveAsPlugin
];
