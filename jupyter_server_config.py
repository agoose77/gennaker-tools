import os

from jupyter_server.services.contents.largefilemanager import AsyncLargeFileManager 
from pathlib import Path
from traitlets import List

class ReadOnlyContentsManager(AsyncLargeFileManager):

    read_only_paths = List(
        config = True
    )

    def is_writable(self, path):
        """Does the API style path correspond to a writable directory or file?

        Parameters
        ----------
        path : str
            The path to check. This is an API path (`/` separated,
            relative to root_dir).

        Returns
        -------
        hidden : bool
            Whether the path exists and is writable.
        """
        path = path.strip("/")
        os_path = self._get_os_path(path=path)
        requested_path = Path(os_path).absolute()
        
        self.log.debug("Read only paths: %s", self.read_only_paths)

        for item in self.read_only_paths:
            p = Path(item).absolute()
            if requested_path.is_relative_to(p): 
                return False

        try:
            return os.access(os_path, os.W_OK)
        except OSError:
            self.log.error("Failed to check write permissions on %s", os_path)
            return False

c.ServerApp.contents_manager_class = ReadOnlyContentsManager
c.ReadOnlyContentsManager.read_only_paths = ["src"]