import { snippetsPlugin } from './snippets.js';
import { reloadPlugin } from './reload.js';
import { statelessRunPlugin } from './statelessRun.js';
import { settingsChangedPlugin } from './settingsChanged.js';

export {
  snippetsPlugin,
  statelessRunPlugin,
  reloadPlugin,
  settingsChangedPlugin
};
export default [
  statelessRunPlugin,
  reloadPlugin,
  snippetsPlugin,
  settingsChangedPlugin
];
