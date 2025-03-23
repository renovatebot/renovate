The [`nix`](https://github.com/NixOS/nix) manager supports:

- [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance) updates for `flake.lock`
- input updates for `flake.lock`

For specifying `packageRules` it is important to know how `depName` and `packageName` are defined for nix updates:

- The `depName` field is equal to the nix flake input name, eg. `nix.inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";` would have the `depName` of `nixpkgs`
- The `packageName` field is equal to the fully-qualified root URL of the package source, eg. `https://github.com/NixOS/nixpkgs` for the above example.
