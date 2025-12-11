from jupyter_server.extension.application import ExtensionApp
import jupyterlab.commands

from traitlets import Instance, default, validate, TraitError
import pathlib
import watchfiles
import jupyter_server.serverapp
import asyncio
import tomli
import json
import tomli_w
import re
import os


class SettingsSyncApp(ExtensionApp):
    # -------------- Required traits --------------
    name = "settings-sync"
    load_other_extensions = True
    settings_path = Instance(pathlib.Path)

    _task = Instance(asyncio.Task, allow_none=True)
    _event = Instance(asyncio.Event, allow_none=True)

    @default("settings_path")
    def _default_settings_path(self):
        return pathlib.Path(jupyterlab.commands.get_user_settings_dir())

    @validate("settings_path")
    def _valid_settings_path(self, proposal):
        try:
            _path = pathlib.Path(proposal["value"])
        except TypeError:
            raise TraitError("settings_path should be a valid pathlike value")
        return _path

    def _toml_to_settings_path(self, path: pathlib.Path) -> pathlib.Path:
        return path.with_name(path.stem)

    def _settings_to_toml_path(self, path: pathlib.Path) -> pathlib.Path:
        return path.with_name(f"{path.name}.toml")

    def _is_settings_path(self, path: pathlib.Path) -> bool:
        return path.suffix == ".jupyterlab-settings"

    def _is_toml_path(self, path: pathlib.Path) -> bool:
        return path.suffix == ".toml"

    def _strip_comments(self, source: str) -> str:
        without_single_line_comments = re.sub(r"//.*$", "", source, flags=re.MULTILINE)

        return re.sub(
            r"/\*[\s\S]*?\*/", "", without_single_line_comments, flags=re.MULTILINE
        )

    async def _watched_files_need_sync(
        self, path: pathlib.Path, other_path: pathlib.Path
    ) -> bool:
        return path.stat().st_mtime != other_path.stat().st_mtime

    async def _sync_watched_files(self, path: pathlib.Path, other_path: pathlib.Path):
        self.log.info(f"Detected change in {path} file, synchronising")
        if self._is_settings_path(path):
            settings = json.loads(self._strip_comments(path.read_text()))
            with open(other_path, "wb") as f:
                tomli_w.dump(settings, f)

        else:
            with open(path, "rb") as f:
                settings = tomli.load(f)
            with open(other_path, "w") as sf:
                json.dump(settings, sf, indent=2)

        # Sync mtimes
        stat = path.stat()
        os.utime(other_path, (stat.st_atime, stat.st_mtime))

    async def _unsync_watched_files(self, path: pathlib.Path, other_path: pathlib.Path):
        if self._is_settings_path(path) and other_path.exists():
            other_path.unlink()

    async def _event_loop(self):
        async for changes in watchfiles.awatch(
            self.settings_path, stop_event=self._event
        ):
            for change, _path in changes:
                try:
                    await self._reconcile_change(change, pathlib.Path(_path))
                except Exception as exc:
                    self.log.error(exc)

    async def _reconcile_change(self, change, path):
        # Ignore .~ files
        if path.name.startswith(".~"):
            return

        # Only process settings files
        path_is_toml = self._is_toml_path(path)
        if not (path_is_toml or self._is_settings_path(path)):
            return

        # Find other path
        other_path = (
            self._toml_to_settings_path(path)
            if path_is_toml
            else self._settings_to_toml_path(path)
        )

        # Now we have either TOML or JSON setting files
        # File needs deleting
        if change == watchfiles.Change.deleted:
            await self._unsync_watched_files(path, other_path)

        # Files might need syncing
        elif change == watchfiles.Change.added or change == watchfiles.Change.modified:
            if await self._watched_files_need_sync(path, other_path):
                await self._sync_watched_files(path, other_path)

    async def _start_jupyter_server_extension(self, app):
        self._event = asyncio.Event()
        self._task = asyncio.create_task(self._event_loop())

    async def stop_extension(self):
        if self._event is not None:
            self._event.set()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            finally:
                self._event = None
                self._task = None
