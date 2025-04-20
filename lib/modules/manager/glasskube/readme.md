Extract version data from Packages/ClusterPackages and repository data from PackageRepositories.

To use the `glasskube` manager you must set your own `fileMatch` pattern.
The `glasskube` manager has no default `fileMatch` pattern, because there is no common filename or directory name convention for Glasskube YAML files.
By setting your own `fileMatch` Renovate avoids having to check each `*.yaml` file in a repository for a Glasskube definition.
