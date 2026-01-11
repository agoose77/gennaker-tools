from jupyter_server.extension.application import ExtensionApp
import jupyterlab.commands

from traitlets import Instance, default, validate, TraitError, Unicode
import pathlib
import watchfiles
import jupyter_server.serverapp
import asyncio
import aiofiles.os
import tomli
import json5
import tomli_w
import os


class SettingsSyncApp(ExtensionApp):
    # -------------- Required traits --------------
    name = "settings-sync"
    load_other_extensions = True
    settings_path = Instance(pathlib.Path)
    null_sentinel = Unicode("__NULL__")

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

    def _json_mapping_to_toml(self, mapping):
        return {
            key: self._json_mapping_to_toml(value)
            if isinstance(value, dict)
            else self.null_sentinel
            if value is None
            else value
            for key, value in mapping.items()
        }

    def _toml_mapping_to_json(self, mapping):
        return {
            key: self._toml_mapping_to_json(value)
            if isinstance(value, dict)
            else None
            if value == self.null_sentinel
            else value
            for key, value in mapping.items()
        }

    def _toml_to_settings_path(self, path: pathlib.Path) -> pathlib.Path:
        return path.with_name(path.stem)

    def _settings_to_toml_path(self, path: pathlib.Path) -> pathlib.Path:
        return path.with_name(f"{path.name}.toml")

    def _is_settings_path(self, path: pathlib.Path) -> bool:
        return path.suffix == ".jupyterlab-settings"

    def _is_toml_path(self, path: pathlib.Path) -> bool:
        return path.suffix == ".toml"

    async def _watched_files_need_sync(
        self, path: pathlib.Path, other_path: pathlib.Path
    ) -> bool:
        return not (
            path.exists()
            and other_path.exists()
            and path.stat().st_mtime == other_path.stat().st_mtime
        )

    async def _sync_watched_files(self, path: pathlib.Path, other_path: pathlib.Path):
        try:
            if self._is_settings_path(path):
                self.log.debug(f"Synchronising JSON to TOML for {path}")
                settings = self._json_mapping_to_toml(json5.loads(path.read_text()))
                with open(other_path, "wb") as f:
                    tomli_w.dump(settings, f)

            else:
                self.log.debug(f"Synchronising TOML to JSON for {path}")
                with open(path, "rb") as f:
                    settings = self._toml_mapping_to_json(tomli.load(f))
                with open(other_path, "w") as sf:
                    json5.dump(settings, sf, indent=2)

            # Sync mtimes
            stat = path.stat()
            os.utime(other_path, (stat.st_atime, stat.st_mtime))

        except Exception as exc:
            self.log.error(f"Error reconciling {path} with {other_path} {exc}")

    async def _unsync_watched_files(self, path: pathlib.Path, other_path: pathlib.Path):
        if self._is_settings_path(path) and other_path.exists():
            other_path.unlink()

    async def _reconcile_initial(self, root_path):
        """
        Reconcile existing files. No files will be deleted.
        """
        tasks = []

        async def reconcile(path):
            for entry in await aiofiles.os.scandir(path):
                entry_path = pathlib.Path(entry.path)

                if entry.is_dir():
                    await reconcile(entry_path)
                elif (
                    is_settings_path := self._is_settings_path(entry_path)
                ) or self._is_toml_path(entry_path):
                    other_path = (
                        self._settings_to_toml_path(entry_path)
                        if is_settings_path
                        else self._toml_to_settings_path(entry_path)
                    )
                    # Reconcile onto the "other" file if it doesn't exist, or it's older than us
                    if (
                        not other_path.exists()
                        or other_path.stat().st_mtime <= entry.stat().st_mtime
                    ):
                        tasks.append(self._sync_watched_files(entry_path, other_path))

        await reconcile(root_path)
        await asyncio.gather(*tasks)

    async def _event_loop(self):
        await self._reconcile_initial(self.settings_path)
        async for changes in watchfiles.awatch(
            self.settings_path, stop_event=self._event
        ):
            for change, _path in changes:
                await self._reconcile_change(change, pathlib.Path(_path))

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

        self.log.info(f"Detected change {change} in {path} file, synchronising")
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
