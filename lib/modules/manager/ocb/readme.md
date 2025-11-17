Renovate uses this manager to update dependencies defined in the build definitions for the [OpenTelemetry Collector Builder (ocb)](https://github.com/open-telemetry/opentelemetry-collector/tree/main/cmd/builder).

By default, the `ocb` manager has no `managerFilePatterns` patterns.
This means you must set a `managerFilePatterns` pattern for the `ocb` manager, in order for Renovate to update your `ocb` files.
Here's a configuration example:

```json title="If your builder files are named like foo-builder.yml or builder.yaml"
{
  "ocb": {
    "managerFilePatterns": ["/builder.ya?ml$/"]
  }
}
```

Supported dependencies and their respective `depType`s are:

| Name           | depType      |
| -------------- | ------------ |
| base collector | `collector`  |
| connectors     | `connectors` |
| exports        | `exports`    |
| extensions     | `extensions` |
| processors     | `processors` |

### OpenTelemetry Collector's dual-versioning scheme and pinning digests

OpenTelemetry uses a dual-versioning scheme. For example, confmap providers may be on `v1.45.0`, while the release tag is `v0.139.0`.
To allow Renovate to pin digests for these dependencies, the following `packageRule` is needed:

```json
{
  matchManagers: ["ocb"],
  matchPackageNames: [
    "/^go\\.opentelemetry\\.io\\/collector\\/confmap\\/provider\\/\\w+provider$/",
  ],
  overrideDatasource: "github-tags",
  overridePackageName: "open-telemetry/opentelemetry-collector",
  extractVersion: "^confmap\\/(?<version>.+)"
}
```

Using this packageRule, Renovate will use the GitHub tags on [the opentelemetry-collector repository](https://github.com/open-telemetry/opentelemetry-collector) 
as a datasource instead of using the `go` datasource. In this GitHub repository, it will look for the latest `confmap/v...` tag.
