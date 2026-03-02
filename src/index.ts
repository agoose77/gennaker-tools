import { snippetsPlugin } from './snippets.js';
import { reloadPlugin } from './reload.js';
import { statelessRunPlugin } from './statelessRun.js';

export {
  snippetsPlugin,
  statelessRunPlugin,
  reloadPlugin,
};
export default [
  statelessRunPlugin,
  reloadPlugin,
  snippetsPlugin,
  settingsChangedPlugin
];
