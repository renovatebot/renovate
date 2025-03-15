This datasource finds SBT plugin updates from Maven repositories.

By default, Renovate:

1. Checks `https://repo1.maven.org/maven2/` for SBT plugins
1. If the above URL returns no results, then Renovate tries the _legacy_ URL: `https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases`

You can override the default behavior with the `registryUrls` config option.
For example:

```json
{
  "matchDatasources": ["sbt-plugin"],
  "registryUrls": [
    "https://repo1.maven.org/maven2/",
    "https://oss.sonatype.org/content/repositories/snapshots",
    "https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases"
  ]
}
```
