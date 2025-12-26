The [`devenv`](https://devenv.sh) manager supports:

- [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance) updates for `devenv.lock`
- input updates for `devenv.lock`

For specifying `packageRules` it is important to know how `depName` and `packageName` are defined for devenv updates:

- The `depName` field is equal to the devenv input name
- The `packageName` field is equal to the fully-qualified root URL of the package source, eg. `https://github.com/NixOS/nixpkgs`
