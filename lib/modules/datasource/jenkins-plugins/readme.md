The `jenkins-plugins` datasource supports lookups from the [Jenkins Update Center](https://updates.jenkins.io/) or custom registries.

When you define a custom registry with the `registryUrl` config option, you must follow [Jenkins' update site layout](https://github.com/jenkins-infra/update-center2/blob/master/site/LAYOUT.md).

The `update-center.actual.json` and `plugin-versions.json` files must be in the `current` path, so Renovate can find them.
For example, the files could be put in the `https://custom.registry.renovatebot.com/current` directory.

## Constraints Filtering

This datasource makes it possible to only suggest Jenkins plugin updates based on the `requiredCore` metadata field.
This allows you to only see Jenkins plugin updates based on your Jenkins core version.

If you wish to use [`constraintsFiltering=strict`](../../../configuration-options.md#constraintsfiltering), you will need to either specify a [Maven-style range](../../versioning/maven/readme.md):

```json title="Allow Jenkins plugins that work up to the next Jenkins Core version"
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "constraints": {
    "jenkins": "[,2.165.0)"
  }
}
```

You can also specify an exact version, which will perform a strict match:

```json title="Performing an exact match on Jenkins Core version"
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "constraints": {
    "jenkins": "2.164.3"
  }
}
```
