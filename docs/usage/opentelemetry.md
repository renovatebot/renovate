---
title: OpenTelemetry
description: How to use OpenTelemetry with Renovate
---

# OpenTelemetry and Renovate

Renovate supports OpenTelemetry which is an emerging monitoring standard.

OpenTelemetry supports three types of observability data:

- traces
- metrics
- logs

Renovate can only sent traces and only via the OpenTelemetryProtocol (OTLP), other observability data or transfer protocols are not supported.

## Usage

To activate the instrumentation, the environment variable `OTEL_EXPORTER_OTLP_ENDPOINT` has to be set.
This sets the endpoint where to send the telemetry data. If this endpoint is set, all other environment variables defined by the [OpenTelemetry specification](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/sdk-environment-variables.md) are supported.

For debugging purposes the telemetry can also be printed to the console if the environment variable `RENOVATE_TRACING_CONSOLE_EXPORTER` is set.

## Examples

An usage example with a local OpenTelemetry setup can be found in the [OpenTelemetry examples](examples/opentelemetry.md)
