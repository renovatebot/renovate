Renovate uses this manager to update dependencies defined in the build definitions for the [OpenTelemetry Collector Builder (ocb)](https://github.com/open-telemetry/opentelemetry-collector/tree/main/cmd/builder).

By default, the `ocb` manager has no `managerFilePatterns` patterns.
This means you must set a `managerFilePatterns` pattern for the `ocb` manager, for Renovate to update your `ocb` files.
Here's a configuration example:

```json title="If your builder files are named like foo-builder.yml or builder.yaml"
{
  "ocb": {
    "managerFilePatterns": ["/builder-config.yaml$/"]
  }
}
```

Supported dependencies and their respective `depType`s are:

| Name           | depType      |
| -------------- | ------------ |
| base collector | `collector`  |
| extensions     | `extensions` |
| exporters      | `exports`    |
| receivers      | `receivers`  |
| processors     | `processors` |
| providers      | `providers`  |
| connectors     | `connectors` |
