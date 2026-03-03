from tornado import web, websocket
from jupyter_server.base.handlers import JupyterHandler
from jupyter_server.auth.decorator import ws_authenticated
from jupyter_core.utils import ensure_async
import os
import json


class SettingsChangedHandler(JupyterHandler, websocket.WebSocketHandler):
    async def pre_get(self):
        """Handles authentication/authorization."""
        user = self.current_user
        # Authorize the user.
        authorized = await ensure_async(
            self.authorizer.is_authorized(
                self, user, "execute", "gennaker-tools/settings-changed"
            )
        )
        if not authorized:
            raise web.HTTPError(403)

    @ws_authenticated
    async def get(self, *args, **kwargs):
        """Get an event socket."""
        await self.pre_get()
        return await super().get(*args, **kwargs)

    def open(self):
        self.log.debug("Opened websocket")
        self.settings["settings_handlers"].append(self)

    def on_close(self):
        self.log.debug("Closed websocket")
        self.settings["settings_handlers"].remove(self)

    async def on_message(self, message):
        self.log.debug("Received message from frontend")

    def notify_toml_changed(self, file_path, event):
        root = self.serverapp.root_dir
        try:
            file_path_to_root = file_path.relative_to(root)
        except ValueError:
            self.log.debug("Could not compute root-relative path for {file_path}")
            file_path_to_root = None

        self.write_message(
            json.dumps(
                {
                    # I think NB file paths are all POSIX
                    "file_path": file_path_to_root.as_posix(),
                    "change": str(event),
                    "fs_file_path": os.fspath(file_path),
                }
            )
        )
