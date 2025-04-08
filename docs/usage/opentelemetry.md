---
title: OpenTelemetry
description: How to use OpenTelemetry with Renovate
---

# OpenTelemetry and Renovate

<!-- prettier-ignore -->
!!! warning "This feature is flagged as experimental"
    Experimental features might be changed or even removed at any time.

Renovate partially supports OpenTelemetry, the emerging monitoring standard.

OpenTelemetry has three types of observability data:

- traces
- metrics
- logs

## Limitations

While OTLP support traces, metrics, and logs, Renovate only supports traces.
This means Renovate does not support other observability data like: stats on caching, error events, number of found updates, and so on.

Renovate uses [`@opentelemetry/exporter-trace-otlp-http`](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-http) and [`@opentelemetry/auto-instrumentations-node`](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node) under the hood.
This means that Renovate sends traces via [OTLP/HTTP](https://opentelemetry.io/docs/reference/specification/protocol/otlp/#otlphttp) in JSON-encoded protobuf format only.

## Usage

To activate the instrumentation, you must set the `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable.
This variable controls the endpoint for the telemetry data.
Once this endpoint is set, you can use all environment variables listed in the [OpenTelemetry specification](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/configuration/sdk-environment-variables.md).
You can also set the following environment variables:

- `OTEL_SERVICE_NAME`: to control the service name that will be emitted in traces, defaults to `renovate`
- `OTEL_SERVICE_NAMESPACE`: to control the service namespace that will be emitted in traces, defaults to `renovatebot.com`
- `OTEL_SERVICE_VERSION`: to control the service version that will be emitted in traces, defaults to using the release version of Renovate
- `OTEL_RESOURCE_ATTRIBUTE`: to add a list of comma separated key/value attributes that will be emitted in traces. For instance: `host.name=localhost,host.ip=127.0.0.1`

`@opentelemetry/auto-instrumentations-node` adds support for multiple instrumentations, see the full list [here](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node#supported-instrumentations).

You can choose to disable some instrumentations with `OTEL_NODE_DISABLED_INSTRUMENTATIONS`, for example to disable only `@opentelemetry/instrumentation-net`:

```
export OTEL_NODE_DISABLED_INSTRUMENTATIONS="net"
```

## Debugging

To help you debug, you can print the telemetry to the console.
Use the environment variable `RENOVATE_TRACING_CONSOLE_EXPORTER`.

## Examples

An example with a local OpenTelemetry setup can be found on the [OpenTelemetry examples](examples/opentelemetry.md) page.
