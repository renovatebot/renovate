The [`nix`](https://github.com/NixOS/nix) manager supports:

- [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance) updates for `flake.lock`
- root input updates in `flake.nix` and `flake.lock` for Git, GitHub, GitLab, SourceHut, supported HTTP tarball, and Nix channel sources

Renovate can update URLs declared directly:

```nix
inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
```

Renovate can also update a simple attribute set when `url` is its first member:

```nix
inputs.nixpkgs = {
  url = "github:NixOS/nixpkgs/nixos-unstable";
};
```

Complex Nix expressions and attribute sets where another member appears before `url` are not updated.
FlakeHub inputs are not supported because FlakeHub version constraints require registry-specific version lookup.

Renovate also proposes digest updates for root inputs that track a branch, such as `nixos-unstable`, or a repository's default branch, such as `github:owner/repo`.
These updates refresh the revision in `flake.lock` without changing the URL in `flake.nix`, so a moving branch can produce a new update whenever its upstream revision changes.
Previously, these revisions were refreshed only by lock file maintenance.

For nix inputs, the `pin` range strategy is treated as `update-lockfile`, matching the default `auto` strategy. If you prefer to refresh those revisions through lock file maintenance, disable individual Nix digest updates:

```json
{
  "packageRules": [
    {
      "matchManagers": ["nix"],
      "matchUpdateTypes": ["digest"],
      "enabled": false
    }
  ],
  "lockFileMaintenance": {
    "enabled": true
  }
}
```

This rule leaves version updates enabled and does not disable lock file maintenance.

For specifying `packageRules` it is important to know how `depName` and `packageName` are defined for nix updates:

- The `depName` field is equal to the Nix flake input name, for example `nix.inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";` has the `depName` of `nixpkgs`
- The `packageName` field is equal to the fully-qualified root URL of the package source, for example `https://github.com/NixOS/nixpkgs` for the above example
