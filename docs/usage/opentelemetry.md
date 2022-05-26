---
title: OpenTelemetry
description: How to use OpenTelemetry with Renovate
---

# OpenTelemetry and Renovate

Renovate supports OpenTelemetry which is an emerging monitoring standard.

To activate the instrumentation, the environment variable `OTEL_EXPORTER_OTLP_ENDPOINT` has to be set.
This sets the endpoint where to send the telemetry data. If this endpoint is set, all other environment variables defined by the [OpenTelemetry specification](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/sdk-environment-variables.md) are supported.

For debugging purposes the telemetry can also be printed to the console if the environment variable `RENOVATE_DEBUG_TRACING` is set.
