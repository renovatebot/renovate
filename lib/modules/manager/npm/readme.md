The following `depTypes` are currently supported by the npm manager :

- `dependencies`
- `devDependencies`
- `optionalDependencies`
- `peerDependencies`
- `engines` : Renovate will update any `node`, `npm` and `yarn` version specified under `engines`.
- `volta` : Renovate will update any `node`, `npm`, `pnpm` and `yarn` version specified under `volta`.
- `packageManager`

### Yarn

#### Version Selection / Installation

If Renovate detects a `packageManager` setting for Yarn in `package.json` then it will use Corepack to install Yarn.

#### HTTP Proxy Support

Yarn itself does not natively recognize/support the `HTTP_PROXY` and `HTTPS_PROXY` environment variables.

You can configure `RENOVATE_X_YARN_PROXY=true` as an environment variable to enable configuring of Yarn proxy (e.g. if you cannot configure these proxy settings yourself in `~/.yarnrc.yml`).

If set, and Renovate detects Yarn 2+, and one or both of those variables are present, then Renovate will run commands like `yarn config set --home httpProxy http://proxy` prior to executing `yarn install`.
This will result in the `~/.yarnrc.yml` file being created or modified with these settings, and the settings are not removed afterwards.

Configuration/conversion of `NO_PROXY` to Yarn config is not supported.
