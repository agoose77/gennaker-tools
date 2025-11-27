# gennaker-tools

[![Github Actions Status](https://github.com/agoose77/gennaker-tools/workflows/Build/badge.svg)](https://github.com/agoose77/gennaker-tools/actions/workflows/build.yml)

A series of JupyterLab and Jupyter Server extensions to power the gennaker project.

## Features
### TOML ←→ JSON Settings Sync
<img width="1130" height="900" alt="image" src="https://github.com/user-attachments/assets/c9babdd6-d247-45a1-a590-f17165f5b7fb" />

_Synchronise between JSON and TOML representations of settings under the JupyterLab settings path._

## Code Snippets
<img width="1350" height="870" alt="image" src="https://github.com/user-attachments/assets/4e2673a9-3e27-4535-a3b0-b86e27f12f49" />

_Use CodeMirror snippets to autocomplete text and modular units of content._ See https://codemirror.net/docs/ref/#autocomplete.autocompletion for more information.

## Reset Command
```
gennaker-tools:reset-jupyterlab
```

<img width="887" height="423" alt="image" src="https://github.com/user-attachments/assets/2ef028a5-0eca-45ab-81e1-f22627c427c1" />

_Reset the current session by reloading the page_.

## Stateless Execution Command

```
gennaker-tools:restart-run-stateless
```

<img width="627" height="318" alt="image" src="https://github.com/user-attachments/assets/079684f8-e7bc-484f-b466-533f2dc1665e" />

_Perform some compute_

<img width="618" height="140" alt="image" src="https://github.com/user-attachments/assets/0029730a-e9ea-4791-8f61-a4ed0da783f8" />

_Modify the earlier state_

<img width="626" height="362" alt="image" src="https://github.com/user-attachments/assets/18ad2055-105e-461e-af36-5be4b4c7c51e" />

_Re-run up to a particular cell, and clear outputs_

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install gennaker-tools
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall gennaker-tools
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the gennaker_tools directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall gennaker-tools
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `gennaker-tools` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
