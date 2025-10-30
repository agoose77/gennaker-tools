from jupyter_server.extension.application import ExtensionApp
import jupyter_server.serverapp
import asyncio


class TOMLSyncApp(ExtensionApp):
    # -------------- Required traits --------------
    name = "toml-sync"
    load_other_extensions = True

    async def _start_jupyter_server_extension(self):
        ...
        print("START")
        # Extend this method to start any (e.g. async) tasks
        # after the main Server's Event Loop is running.

    async def stop_extension(self):
        ...
        # Perform any required shut down steps
