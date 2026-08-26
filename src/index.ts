import { snippetsPlugin } from './snippets.js';
import { reloadPlugin } from './reload.js';
import { statelessRunPlugin } from './statelessRun.js';
import { tomlSyncPlugin } from './tomlSync.js';
import { saveAsPlugin } from './saveAs.js';
import { watchDiskPlugin } from './watchDisk.js';
import { shutdownPlugin } from './shutdown.js';

export {
  snippetsPlugin,
  statelessRunPlugin,
  reloadPlugin,
  tomlSyncPlugin,
  saveAsPlugin,
  watchDiskPlugin,
  shutdownPlugin
};
export default [
  statelessRunPlugin,
  reloadPlugin,
  snippetsPlugin,
  tomlSyncPlugin,
  saveAsPlugin,
  watchDiskPlugin,
  shutdownPlugin
];
