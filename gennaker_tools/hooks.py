from pathlib import Path


def keyboard_shortcuts_hook(json_settings_path, json_path, contents):
    relative_path = json_path.relative_to(json_settings_path)
    print(relative_path)
    if relative_path != Path(
        "@jupyterlab", "shortcuts-extension", "shortcuts.jupyterlab-settings"
    ):
        return contents

    shortcuts = contents["shortcuts"]
    for shortcut in shortcuts:
        if not shortcut["args"]:
            del shortcut["args"]

        if shortcut.get("macKeys") == [""]:
            del shortcut["macKeys"]

        if shortcut.get("keys") == [""]:
            del shortcut["keys"]
    return contents

