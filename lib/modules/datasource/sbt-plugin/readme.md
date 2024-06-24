This datasource finds SBT plugin updates from Maven repositories.

By default, Renovate checks <https://repo1.maven.org/maven2/> for SBT plugins, and then falls back to the legacy URL <https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases>. You can override this behavior by overriding the `registryUrls` setting. For example:

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
