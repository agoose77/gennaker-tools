{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };
  outputs = {
    self,
    nixpkgs,
  }: let
    forAllSystems = nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed;
  in {
    devShells = forAllSystems (system: let
      pkgs = import nixpkgs {inherit system;};
      inherit (pkgs) lib;
      python = pkgs.python314;
    in {
      default =
        (pkgs.buildFHSEnv {
          name = "python-env";
          targetPkgs = pkgs:
            (with pkgs; [
              pythonManylinuxPackages.manylinux2014Package
              cmake
              ninja
              gcc
              pre-commit
              nodejs_22
            ])
            ++ [python];
          runScript = "${pkgs.writeShellScriptBin "runScript" ''
            test -d .venv || ${python.interpreter} -m venv .venv
            source .venv/bin/activate
            set +e

            exec ${lib.getExe pkgs.bash} "$@"
          ''}/bin/runScript";
        })
        .env;
    });
  };
}
