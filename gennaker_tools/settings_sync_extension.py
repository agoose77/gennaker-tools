from jupyter_server.extension.application import ExtensionApp
import jupyterlab.commands

from traitlets import (
    Instance,
    default,
    validate,
    TraitError,
    Unicode,
    List,
    Union,
    Bool,
)
import pathlib
import fnmatch
import watchfiles
import jupyter_server.serverapp
import asyncio
import aiofiles.os
import tomli
import json5
import re
import tomli_w
import os


class SettingsSyncApp(ExtensionApp):
    # -------------- Required traits --------------
    name = "settings-sync"
    load_other_extensions = True

    source_path = Union(
        (Instance(pathlib.Path), Unicode()),
        help="Filepath to the source JSON settings.",
        config=True,
    )
    dest_path = Union(
        (Instance(pathlib.Path), Unicode()),
        help="Filepath to the desination TOML settings.",
        config=True,
    )

    null_sentinel = Unicode(
        "__NULL__",
        help="Sentinel string value to represent null values in TOML.",
        config=True,
    )
    ignore_patterns = List(
        Unicode(),
        [".ipynb_checkpoints", ".~*"],
        help="Glob patterns for file names to ignore.",
        config=True,
    )
    watch_for_changes = Bool(config=True)

    _task = Instance(asyncio.Task, allow_none=True)
    _event = Instance(asyncio.Event, allow_none=True)

    @default("dest_path")
    def _default_dest_path(self):
        return self.source_path

    @default("source_path")
    def _default_source_path(self):
        return pathlib.Path(jupyterlab.commands.get_user_settings_dir())

    @validate("source_path", "dest_path")
    def _valid_source_path(self, proposal):
        try:
            _path = pathlib.Path(proposal["value"]).resolve()
        except TypeError:
            raise TraitError(
                f"{proposal['trait'].name} should be a valid pathlike value"
            )
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

    def _toml_to_source_path(self, path: pathlib.Path) -> pathlib.Path:
        sub_path = path.relative_to(self.dest_path)
        return self.source_path / sub_path.with_name(path.stem)

    def _settings_to_toml_path(self, path: pathlib.Path) -> pathlib.Path:
        sub_path = path.relative_to(self.source_path)
        return self.dest_path / sub_path.with_name(f"{path.name}.toml")

    def _is_source_path(self, path: pathlib.Path) -> bool:
        return (
            path.is_relative_to(self.source_path)
            and path.suffix == ".jupyterlab-settings"
        )

    def _is_toml_path(self, path: pathlib.Path) -> bool:
        return path.is_relative_to(self.dest_path) and re.match(
            r".*\.jupyterlab-settings.toml", path.name
        )

    def _change_is_observed(self, change: watchfiles.Change, path: str) -> bool:
        _path = pathlib.Path(path)
        if _path.is_relative_to(self.source_path):
            sub_path = _path.relative_to(self.source_path)
        else:
            sub_path = _path.relative_to(self.dest_path)

        return not any(
            fnmatch.fnmatch(part, pat)
            for part in sub_path.parts
            for pat in self.ignore_patterns
        )

    async def _watched_files_need_sync(
        self, path: pathlib.Path, other_path: pathlib.Path
    ) -> bool:
        return not (
            path.exists()
            and other_path.exists()
            and path.stat().st_mtime == other_path.stat().st_mtime
        )

    async def _sync_watched_files(self, path: pathlib.Path, other_path: pathlib.Path):
        # Ensure that the destinations exist
        path.parent.mkdir(exist_ok=True, parents=True)
        other_path.parent.mkdir(exist_ok=True, parents=True)

        try:
            if self._is_source_path(path):
                self.log.debug(f"Synchronising JSON to TOML for {path}")
                settings = self._json_mapping_to_toml(json5.loads(path.read_text()))
                with open(other_path, "wb") as f:
                    tomli_w.dump(settings, f)

            else:
                self.log.debug(f"Synchronising TOML to JSON for {path}")
                with open(path, "rb") as f, open(other_path, "w") as sf:
                    settings = self._toml_mapping_to_json(tomli.load(f))
                    json5.dump(settings, sf, indent=2)

            # Sync mtimes
            stat = path.stat()
            os.utime(other_path, (stat.st_atime, stat.st_mtime))

        except Exception as exc:
            self.log.error(f"Error reconciling {path} with {other_path} {exc}")

    async def _unsync_watched_files(self, path: pathlib.Path, other_path: pathlib.Path):
        if self._is_source_path(path) and other_path.exists():
            other_path.unlink()

    async def perform_initial_reconciliation(self):
        """
        Reconcile existing files. No files will be deleted.
        """

        async def reconcile(dir_path):
            for entry in await aiofiles.os.scandir(dir_path):
                entry_path = pathlib.Path(entry.path)
                # Ignored directories/files should be skipped
                if any(
                    fnmatch.fnmatch(entry_path.name, p) for p in self.ignore_patterns
                ):
                    continue

                if entry.is_dir():
                    await reconcile(entry_path)
                elif (
                    is_source_path := self._is_source_path(entry_path)
                ) or self._is_toml_path(entry_path):
                    other_path = (
                        self._settings_to_toml_path(entry_path)
                        if is_source_path
                        else self._toml_to_source_path(entry_path)
                    )
                    # Reconcile onto the "other" file if it doesn't exist, or it's older than us
                    if (
                        not other_path.exists()
                        or other_path.stat().st_mtime < entry.stat().st_mtime
                    ):
                        await self._sync_watched_files(entry_path, other_path)

        await reconcile(self.source_path)
        await reconcile(self.dest_path)

    async def watch_for_changes(self):
        async for changes in watchfiles.awatch(
            self.source_path,
            self.dest_path,
            stop_event=self._event,
            watch_filter=self._change_is_observed,
        ):
            for change, _change_path in changes:
                change_path = pathlib.Path(_change_path)
                await self._reconcile_change(change, change_path)

    async def _event_loop(self):
        await self.perform_initial_reconciliation()
        if self.watch_for_changes:
            await self.watch_for_changes()

    async def _reconcile_change(self, change, path):
        # Only process settings files
        path_is_toml = self._is_toml_path(path)
        if not (path_is_toml or self._is_source_path(path)):
            return

        # Find other path
        other_path = (
            self._toml_to_source_path(path)
            if path_is_toml
            else self._settings_to_toml_path(path)
        )

        self.log.debug(f"Detected filesystem change {change} in {path} file")

        match change:
            # Now we have either TOML or JSON setting files
            # File needs deleting
            case watchfiles.Change.deleted:
                self.log.info(
                    f"Detected deletion of {path.name} settings file, synchronising"
                )
                await self._unsync_watched_files(path, other_path)
            case watchfiles.Change.added:
                if await self._watched_files_need_sync(path, other_path):
                    self.log.info(
                        f"Detected addition of {path.name} settings file, creating {other_path.name}"
                    )
                    await self._sync_watched_files(path, other_path)
            case watchfiles.Change.modified:
                if await self._watched_files_need_sync(path, other_path):
                    self.log.info(
                        f"Detected modification of {path.name} settings file, updating {other_path.name}"
                    )
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
