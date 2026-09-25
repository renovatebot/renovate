The `jenkins-plugins` datasource supports lookups from the [Jenkins Update Center](https://updates.jenkins.io/) or custom registries.

When you define a custom registry with the `registryUrl` config option, you must follow [Jenkins' update site layout](https://github.com/jenkins-infra/update-center2/blob/master/site/LAYOUT.md).

The `update-center.actual.json` and `plugin-versions.json` files must be in the `current` path, so Renovate can find them.
For example, the files could be put in the `https://custom.registry.renovatebot.com/current` directory.

## Constraints Filtering

This datasource makes it possible to filter Jenkins plugin updates based on the Jenkins Core version the plugin requires, when setting [`constraintsFiltering=strict`](../../../configuration-options.md#constraintsfiltering).
This allows you to only see Jenkins plugin updates based on your Jenkins core version.

This constraint is derived from the `requiredCore` metadata field in the API response.

If using [`constraintsFiltering=strict`](../../../configuration-options.md#constraintsfiltering), it is recommended to specify a [Maven-style range](../../versioning/maven/readme.md):

```json title="Allow Jenkins plugins that require Jenkins Core <2.545.0"
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "constraints": {
    "jenkins": "(,2.545.0)"
  }
}
```

```json title="Allow Jenkins plugins that require Jenkins Core 2.545.x"
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "constraints": {
    "jenkins": "[2.545.0,2.546.0]"
  }
}
```

<!-- prettier-ignore -->
!!! warning
    Using an exact match is not recommended, as it is unlikely there will be many plugins that support the exact patch version of Jenkins Core you have specified.

You can also specify an exact version, which will perform a strict match:

```json title="Only allow plugin versions that require exactly Jenkins Core 2.164.3"
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "constraints": {
    "jenkins": "2.164.3"
  }
}
```
