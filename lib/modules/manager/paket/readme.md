Manage dependencies for [Paket](https://fsprojects.github.io/Paket/)

Extracts dependencies from files:

- `paket.dependencies`
- `paket.lock`

The `source` entries of each group are used as registry URLs for the dependencies of that group.

Restrictions:

- Only updates nuget source (github, gist, http, and git not supported)
- Version constraints in `paket.dependencies` are updated with the [`paket` versioning](../../versioning/paket/index.md) module
- If `paket.lock` is missing, dependencies are extracted but not updated
- Private feeds work for update detection via `hostRules`. For `paket update`, credentials are not provisioned automatically from `hostRules`: reference environment variables in the source definition (`source https://... username: "%FEED_USER%" password: "%FEED_PASS%"`) and expose them to the tool with `customEnvVariables`
