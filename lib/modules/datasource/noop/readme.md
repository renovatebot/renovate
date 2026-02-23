The `noop` datasource never returns any version updates.

It is useful when a package manager needs a datasource to correctly extract a dependency, but version updates should not be provided (e.g. because updates are handled by lock file maintenance instead).

When a `currentValue` is set, the datasource returns only that version as a release, ensuring Renovate sees no newer versions to update to.
