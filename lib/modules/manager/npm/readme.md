The following `depTypes` are currently supported by the npm manager :

- `dependencies`
- `devDependencies`
- `optionalDependencies`
- `peerDependencies`
- `engines` : Renovate will update any `node`, `npm` and `yarn` version specified under `engines`.
- `volta` : Renovate will update any `node`, `npm`, `pnpm` and `yarn` version specified under `volta`.
- `packageManager`

Lerna is no longer explicitly supported.
Since v7, the removal of `lerna bootstrap` has meant that Renovate needs no Lerna-specific awareness/functionality.
In Renovate v37, it was decided to drop explicit Lerna support for Lerna v6 and below to enable a simplification of the npm, pnpm and Yarn logic.
