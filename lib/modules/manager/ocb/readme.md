Renovate uses this manager to update dependencies defined in the build definitions for the [OpenTelemetry Collector Builder (ocb)](https://github.com/open-telemetry/opentelemetry-collector/tree/main/cmd/builder).

The `ocb` manager has no `fileMatch` default patterns, so it won't match any files until you configure it with a pattern.

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
