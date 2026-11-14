Renovate updates the Maven dependencies declared in the `maven.dependencies` section of [Smithy](https://smithy.io) `smithy-build.json` files.
For example:

<!-- schema-validation-disable-next-block -->

```json title="Smithy build file"
{
  "version": "1.0",
  "maven": {
    "dependencies": ["software.amazon.smithy:smithy-aws-traits:1.37.0"],
    "repositories": [{ "url": "https://repo.example.com/maven" }]
  }
}
```

Repositories from `maven.repositories` are used as the registries for version lookups.
When the file defines no repositories, Renovate defaults to Maven Central, which matches Smithy's own resolution behavior.

Dependency coordinates or repository URLs that contain `${ENV_VAR}` placeholders are skipped.
If all your repositories use placeholders, configure [`registryUrls`](../../../configuration-options.md#registryurls) in your Renovate config instead.

Maven version ranges like `[1.0, 2.0)` are supported via Maven versioning.
