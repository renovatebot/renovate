The following `depTypes` are currently supported by the npm manager :

- `dependencies`
- `devDependencies`
- `optionalDependencies`
- `peerDependencies`
- `engines` : Renovate will update any `node`, `npm` and `yarn` version specified under `engines`.
- `volta` : Renovate will update any `node`, `npm`, `pnpm` and `yarn` version specified under `volta`.
- `packageManager`

## Corepack support

The Renovate full image installs Yarn v1 by default.
This means that Yarn 2+ is supported "out of the box" only through the traditional approach of configuring a `yarnPath` in `.yarnrc.yml`.

The Renovate image will use the Corepack-based versions of pnpm and Yarn, in future.
We will make this change once Node.js enables Corepack by default.

## Use of packageManager URLs

Support for `https://` URLs in the `packageManager` field was added to Corepack in February 2024 and is supported in Renovate for Yarn.
If Renovate encounters a `packageManager` value for Yarn which is not a valid semver version, it will assume a Yarn constraint of `^3.0.0` and enable Corepack before running Yarn.

## Manual Constraint setting

If Renovate detects versions of Node, Corepack or package managers incorrectly, you can override them using Renovate's `constraints` setting.
It shouldn't normally be required, but the following is an example:

```json title="Example Yarn constraints override"
{
  "constraints": {
    "node": "^20.0.0",
    "corepack": "0.25.0",
    "yarn": "^3.0.0"
  }
}
```
