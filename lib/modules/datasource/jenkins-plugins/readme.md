The `jenkins-plugins` datasource supports lookups from the [Jenkins Update Center](https://updates.jenkins.io/) or custom registries.

Custom registries defined via `registryUrl` are expected to follow the [update site layout](https://github.com/jenkins-infra/update-center2/blob/master/site/LAYOUT.md).

Renovate expects `update-center.actual.json` and `plugin-versions.json` to be available under the `current` path (e.g., `https://custom.registry.renovatebot.com/current`).
