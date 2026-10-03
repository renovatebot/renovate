Manage dependencies for [Paket](https://fsprojects.github.io/Paket/)

Extracts dependencies from files:

- `paket.dependencies`
- `paket.lock`

The `source` entries of each group are used as registry URLs for the dependencies of that group.

Restrictions:

- Only updates nuget source (github, gist, http, and git not supported)
- Version constraints in `paket.dependencies` are updated with the [`paket` versioning](../../versioning/paket/index.md) module
- If `paket.lock` is missing, version constraints in `paket.dependencies` are still updated but no lock file is generated; dependencies without a version constraint are skipped
- Private feeds work for update detection via `hostRules`. For `paket update`, credentials are not provisioned automatically from `hostRules`: reference environment variables in the source definition (`source https://... username: "%FEED_USER%" password: "%FEED_PASS%"`) and expose them to the tool with `customEnvVariables`
