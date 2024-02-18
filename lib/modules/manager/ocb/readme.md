Renovate uses this manager to update dependencies defined in the build definitions for the [OpenTelemetry Collector Builder (ocb)](https://github.com/open-telemetry/opentelemetry-collector/tree/main/cmd/builder).

By default, the `ocb` manager has no `fileMatch` patterns.
This means you must set a `fileMatch` pattern for the `ocb` manager, in order for Renovate to update your `ocb` files.
Here's a configuration example:

```json title="If your builder files are named like foo-builder.yml or builder.yaml"
{
  "ocb": {
    "fileMatch": ["builder.ya?ml$"]
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
