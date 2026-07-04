Manage dependencies for [Paket](https://fsprojects.github.io/Paket/)

Extracts dependencies from files:

- `paket.dependencies`
- `paket.lock`

The `source` entries of each group are used as registry URLs for the dependencies of that group.

Restrictions:

- Only updates nuget source (github, gist, http, and git not supported)
- Dependencies with a version constraint in `paket.dependencies` are extracted but not updated, because there is no versioning for Paket constraint syntax
- If `paket.lock` is missing, dependencies are extracted but not updated
- Private feed authentication is not supported
