from jupyter_server.extension.application import ExtensionApp
import jupyterlab.commands

from traitlets import (
    Callable,
    Instance,
    default,
    validate,
    TraitError,
    Unicode,
    List,
    Union,
    Bool,
)
import enum
import pathlib
import fnmatch
import watchfiles
import jupyter_server.serverapp
import asyncio
import tomli
import json5
import tomli_w
import functools
import os

from .handlers import SettingsChangedHandler


class FileSystemEvent(enum.StrEnum):
    deleted = enum.auto()
    modified = enum.auto()


def operation(func):
    @functools.wraps(func)
    def wrapper(self, source, dest):
        method = func.__get__(self)
        try:
            method(source, dest)
        except Exception:
            self.log.error(
                f"An error occurred during synchronisation of {source.name} onto {dest.name}"
            )
            return False
        else:
            self.log.info(f"Synchronising {source.name} onto {dest.name}")
            return True

    return wrapper


class SettingsSyncApp(ExtensionApp):
    name = "settings-sync"
    load_other_extensions = True
    handlers = [
        (r"gennaker-tools/settings-changed", SettingsChangedHandler),
    ]

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
    watch_for_changes = Bool(
        True, config=True, help="Turn off watcher for settings synchronisation."
    )
    settings_changed_hook = Callable(
        None,
        allow_none=True,
        config=True,
        help="Callable hook to invoke if a settings file is changed. This hook will be called with the root JSON settings path, the path to the JSON file (even if the TOML file was changed), and the parsed settings data. The hook must return a new (or mutated) settings object if defined.",
    )

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

    def initialize_settings(self):
        self.settings["settings_handlers"] = []

    def notify_toml_changed(self, toml_path: pathlib.Path, fs_event: FileSystemEvent):
        for handler in self.settings["settings_handlers"]:
            handler.notify_toml_changed(toml_path, fs_event)

    def pre_process_settings(self, json_path: pathlib.Path, contents: dict) -> dict:
        if callable(self.settings_changed_hook):
            return self.settings_changed_hook(self.source_path, json_path, contents)
        return contents

    def prepare_json_map_for_toml(self, mapping: dict) -> dict:
        return {
            key: self.prepare_json_map_for_toml(value)
            if isinstance(value, dict)
            else self.null_sentinel
            if value is None
            else value
            for key, value in mapping.items()
        }

    def prepare_toml_map_for_json(self, mapping: dict) -> dict:
        return {
            key: self.prepare_toml_map_for_json(value)
            if isinstance(value, dict)
            else None
            if value == self.null_sentinel
            else value
            for key, value in mapping.items()
        }

    def toml_to_json_path(self, path: pathlib.Path) -> pathlib.Path:
        sub_path = path.relative_to(self.dest_path)
        return self.source_path / sub_path.with_suffix(".jupyterlab-settings")

    def json_to_toml_path(self, path: pathlib.Path) -> pathlib.Path:
        sub_path = path.relative_to(self.source_path)
        return self.dest_path / sub_path.with_suffix(".toml")

    def is_json_path(self, path: pathlib.Path) -> bool:
        return (
            path.is_relative_to(self.source_path)
            and path.suffix == ".jupyterlab-settings"
        )

    def is_toml_path(self, path: pathlib.Path) -> bool:
        return path.is_relative_to(self.dest_path) and path.suffix == ".toml"

    def name_is_ignored(self, name: str) -> bool:
        return any(fnmatch.fnmatch(name, pat) for pat in self.ignore_patterns)

    def path_is_tracked(self, path: str) -> bool:
        path = pathlib.Path(path)
        if path.is_relative_to(self.source_path):
            sub_path = path.relative_to(self.source_path)
        else:
            sub_path = path.relative_to(self.dest_path)

        if any(self.name_is_ignored(part) for part in sub_path.parts):
            return False

        return self.is_toml_path(path) or self.is_json_path(path)

    def file_is_newer(
        self, source_path: pathlib.Path, reference_path: pathlib.Path
    ) -> bool:

        return source_path.stat().st_mtime > reference_path.stat().st_mtime

    def sync_file_mtimes(self, source_path: pathlib.Path, target_path: pathlib.Path):
        stat = source_path.stat()
        os.utime(target_path, (stat.st_atime, stat.st_mtime))

    # Sync routines ########################
    @operation
    def sync_json_modification_to_toml(
        self, json_path: pathlib.Path, toml_path: pathlib.Path
    ):
        try:
            # Ensure that the destination exists
            toml_path.parent.mkdir(exist_ok=True, parents=True)

            with open(json_path, "rb") as sf, open(toml_path, "wb") as tf:
                settings = self.pre_process_settings(
                    json_path, self.prepare_json_map_for_toml(json5.load(sf))
                )
                tomli_w.dump(settings, tf)
        finally:
            self.sync_file_mtimes(json_path, toml_path)

    @operation
    def sync_json_deletion_to_toml(
        self, json_path: pathlib.Path, toml_path: pathlib.Path
    ):
        toml_path.unlink()

    @operation
    def sync_toml_modification_to_json(
        self, toml_path: pathlib.Path, json_path: pathlib.Path
    ):
        try:
            # Ensure that the destination exists
            json_path.parent.mkdir(exist_ok=True, parents=True)

            with open(toml_path, "rb") as sf, open(json_path, "w") as tf:
                settings = self.pre_process_settings(
                    json_path, self.prepare_toml_map_for_json(tomli.load(sf))
                )
                json5.dump(settings, tf, indent=2)
        finally:
            self.sync_file_mtimes(toml_path, json_path)

    @operation
    def sync_toml_deletion_to_json(
        self, toml_path: pathlib.Path, json_path: pathlib.Path
    ):
        json_path.unlink()

    def reconcile_json_change(self, json_path: pathlib.Path, fs_event: FileSystemEvent):
        toml_path = self.json_to_toml_path(json_path)
        if fs_event == FileSystemEvent.modified and self.file_is_newer(
            json_path, toml_path
        ):
            self.sync_json_modification_to_toml(json_path, toml_path)
        elif fs_event == FileSystemEvent.deleted and toml_path.exists():
            self.sync_json_deletion_to_toml(json_path, toml_path)

    def reconcile_toml_change(self, toml_path: pathlib.Path, fs_event: FileSystemEvent):
        json_path = self.toml_to_json_path(toml_path)
        if fs_event == FileSystemEvent.modified and self.file_is_newer(
            toml_path, json_path
        ):
            success = self.sync_toml_modification_to_json(toml_path, json_path)
        elif fs_event == FileSystemEvent.deleted and json_path.exists():
            success = self.sync_toml_deletion_to_json(toml_path, json_path)
        else:
            return
        if success:
            self.notify_toml_changed(toml_path, fs_event)

    def perform_initial_reconciliation(self):
        """
        Reconcile existing files. No files will be deleted.
        """
        expected_toml_paths = set()

        # Reconcile JSON files with TOML
        for root, dir_names, file_names in self.source_path.walk():
            # Ignored directories/files should be skipped
            if self.name_is_ignored(root.name):
                continue

            for file_name in file_names:
                file_path = root / file_name
                if not self.is_json_path(file_path):
                    continue

                # Keep track of expected TOML path
                toml_path = self.json_to_toml_path(file_path)
                expected_toml_paths.add(toml_path)

                # Reconcile as a source(JSON)-driven change
                self.sync_json_modification_to_toml(file_path, toml_path)

        # Remove unexpected TOML files
        seen_directories = []
        for root, dir_names, file_names in self.dest_path.walk():
            seen_directories.append(root)
            for file_name in file_names:
                file_path = root / file_name
                if file_path in expected_toml_paths:
                    continue
                # Reconcile as a source(JSON)-driven change
                json_path = self.toml_to_json_path(file_path)
                self.sync_json_deletion_to_toml(json_path, file_path)

        # Remove empty TOML directories
        seen_directories.sort(key=lambda p: len(p.parts), reverse=True)
        for path in seen_directories:
            try:
                next(path.iterdir())
            except StopIteration:
                path.rmdir()

    async def iter_changed_files(self):
        async for changes in watchfiles.awatch(
            self.source_path,
            self.dest_path,
            stop_event=self._event,
            watch_filter=lambda change, path: self.path_is_tracked(path),
        ):
            for change, _path in changes:
                path = pathlib.Path(_path)
                event = (
                    FileSystemEvent.deleted
                    if change == watchfiles.Change.deleted
                    else FileSystemEvent.modified
                )
                yield (path, event)

    async def watch_and_reconcile_changes(self):
        async for path, event in self.iter_changed_files():
            if self.is_json_path(path):
                self.reconcile_json_change(path, event)
            else:
                self.reconcile_toml_change(path, event)

    async def event_loop(self):
        try:
            self.perform_initial_reconciliation()
            if self.watch_for_changes:
                await self.watch_and_reconcile_changes()
        except Exception:
            self.log.error("An unknown error occured", exc_info=True)

    async def _start_jupyter_server_extension(self, app):
        self._event = asyncio.Event()
        self._task = asyncio.create_task(self.event_loop())

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
