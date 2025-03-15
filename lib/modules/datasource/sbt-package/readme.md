This datasource finds SBT package updates from Maven repositories.

By default, Renovate checks `https://repo.maven.apache.org/maven2` for SBT packages.
You can override the default behavior with the `registryUrls` config option.
For example:

```json
{
  "matchDatasources": ["sbt-package"],
  "registryUrls": [
    "https://repo.maven.apache.org/maven2",
    "https://oss.sonatype.org/content/repositories/snapshots"
  ]
}
```
