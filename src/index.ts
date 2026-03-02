import { snippetsPlugin } from './snippets.js';
import { reloadPlugin } from './reload.js';
import { statelessRunPlugin } from './statelessRun.js';
import { tomlSyncPlugin } from './tomlSync.js';

export { snippetsPlugin, statelessRunPlugin, reloadPlugin, tomlSyncPlugin };
export default [
  statelessRunPlugin,
  reloadPlugin,
  snippetsPlugin,
  tomlSyncPlugin
];
