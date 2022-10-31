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

Renovate only:

- sends traces
- uses the OpenTelemetryProtocol (OTLP)

Renovate does not support other observability data or transfer protocols.

## Usage

To activate the instrumentation, you must set the `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable.
This variable controls the endpoint for the telemetry data.
Once this endpoint is set, you can use all environment variables listed in the [OpenTelemetry specification](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/sdk-environment-variables.md).

## Debugging

To help you debug, you can print the telemetry to the console.
Use the environment variable `RENOVATE_TRACING_CONSOLE_EXPORTER`.

## Examples

An example with a local OpenTelemetry setup can be found on the [OpenTelemetry examples](examples/opentelemetry.md) page.
