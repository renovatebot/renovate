The `jenkins-plugins` datasource supports lookups from the [Jenkins Update Center](https://updates.jenkins.io/) or custom registries.

When you define a custom registry with the `registryUrl` config option, you must follow [Jenkins' update site layout](https://github.com/jenkins-infra/update-center2/blob/master/site/LAYOUT.md).

The `update-center.actual.json` and `plugin-versions.json` files must be in the `current` path, so Renovate can find them.
For example, the files could be put in the `https://custom.registry.renovatebot.com/current` directory.
