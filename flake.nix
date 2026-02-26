# code-owner: @agoose77
# This flake sets up an FSH dev-shell that installs all the required
# packages for running deployer, and then installs the tool in the virtual environment
# It is not best-practice for the nix-way of distributing this code,
# but its purpose is to get an environment up and running.
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };
  outputs = {
    self,
    nixpkgs,
  }: let
    forAllSystems = nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed;
  in {
    devShells = forAllSystems (system: let
      pkgs = import nixpkgs {
        inherit system;
        config.allowUnfree = true;
      };
      inherit (pkgs) lib;

      python = pkgs.python313;
      manyLinux = pkgs.pythonManylinuxPackages.manylinux2014;
      node = pkgs.nodejs_24;
      packages =
        [
          python
          python.pkgs.venvShellHook
          node
        ]
        ++ (with pkgs; [
          cmake
          ninja
          gcc
          pre-commit
        ]);
      # Unset these unwanted env vars
      # PYTHONPATH bleeds from Nix Python packages
      unwantedEnvPreamble = ''
        unset SOURCE_DATE_EPOCH PYTHONPATH
      '';
    in {
      default = pkgs.mkShell {
        inherit packages;
        # Define additional input for patching interpreter
        nativeBuildInputs = [pkgs.makeWrapper];

        venvDir = ".venv";

        # Drop bad env vars on activation
        postShellHook = unwantedEnvPreamble;

        # Setup venv by patching interpreter with LD_LIBRARY_PATH
        # This is required because ld does not exist on Nix systems
        postVenvCreation = let
          # Find the interpreter of the venv
          interpreterSubPath = lib.path.subpath.join ["bin" (baseNameOf python.interpreter)];
        in
          unwantedEnvPreamble
          # Patch the venv to find the dynamic libs
          + ''
            wrapProgram "$VIRTUAL_ENV/${interpreterSubPath}" --prefix "LD_LIBRARY_PATH" : "${lib.makeLibraryPath manyLinux}"
          ''
          +
          # Install package
          ''
            pip install -e ".[dev]"
          '';
      };
    });
  };
}
