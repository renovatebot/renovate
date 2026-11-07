Renovate updates the npm plugins declared in your [dprint configuration file](https://dprint.dev/config/).

Versioned `npm:` specifiers like `npm:@dprint/typescript@0.96.1` are extracted and updated via the npm datasource.

The following plugin forms are skipped:

- Unversioned specifiers such as `npm:@dprint/json` — the version is managed by your npm package manager (e.g. via `devDependencies` in `package.json`)
- Process plugins with a tarball checksum such as `npm:@dprint/prettier@0.50.0/plugin.json@<sha256>` — Renovate cannot compute the new checksum when the version changes
- URL-based plugins such as `https://plugins.dprint.dev/typescript-0.91.1.wasm`
