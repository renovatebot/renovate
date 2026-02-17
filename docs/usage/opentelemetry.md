---
title: OpenTelemetry
description: How to use OpenTelemetry with Renovate
---

# OpenTelemetry and Renovate

<!-- prettier-ignore -->
!!! warning "This feature is flagged as experimental"
    Experimental features might be changed at any time.
    <br /> <br />
    Renovate's OpenTelemetry support is stable enough to use in production, but there may be changes that rename attributes or fix bugs in a breaking, even in non-major version updates.

Renovate supports the [OpenTelemetry](https://opentelemetry.io/) monitoring and observability standard.

OpenTelemetry has three types of observability data it supports within the OpenTelemetry Protocol (OTLP):

- traces
- metrics
- logs

<!-- prettier-ignore -->
!!! note
    While the OpenTelemetry Protocol (OTLP) support traces, metrics, and logs, Renovate only supports traces, and some metrics.
    <br /> <br />
    This means Renovate does not support other observability data like: stats on caching, error events, number of found updates, and so on.

Renovate uses [`@opentelemetry/exporter-trace-otlp-http`](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-http) under the hood.
This means that Renovate sends traces via [OTLP/HTTP](https://opentelemetry.io/docs/reference/specification/protocol/otlp/#otlphttp) in JSON-encoded protobuf format only.

## Examples

![A screenshot of the Jaeger OpenTelemetry tracing UI, which shows an in-depth tracing view of a Renovate run against a single repository. The trace view shows the Renovate "splits", i.e. `init`, `extract`, `lookup` and `update` shown, with a view of how long each of the splits take overall. The trace view also shows HTTP calls, calls to the `git` command-line tools, some function names like `extractAllDependencies`, package manager names like `composer` or `github-actions` under the `extract` and `lookup` splits, and general execution of commands (prefixed by `rawExec:`. The view also shows that under the `update` split, there is a trace per branch, so we can see that the `renovate/actions-checkout-6.x` took less time to process than the `renovate/phpstan-phpstan-2.x-lockfile` branch.](assets/images/opentelemetry_trace_viewer.png)

An example for setting up a local OpenTelemetry test setup with Docker can be found on [OpenTelemetry examples page](examples/opentelemetry.md).

## Usage

To activate the instrumentation, you must set the `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable.
This variable controls the endpoint for the telemetry data.
Once this endpoint is set, you can use all environment variables listed in the [OpenTelemetry specification](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/configuration/sdk-environment-variables.md).
You can also set the following environment variables:

- `OTEL_SERVICE_NAME`: to control the service name that will be emitted in traces, defaults to `renovate`
- `OTEL_SERVICE_NAMESPACE`: to control the service namespace that will be emitted in traces, defaults to `renovatebot.com`
- `OTEL_SERVICE_VERSION`: to control the service version that will be emitted in traces, defaults to using the release version of Renovate

The following resource detectors are used:

- `EnvDetector` from @opentelemetry/resources to allow users to add the custom attributes
- `GithubDetector` from [@opentelemetry/resource-detector-github](https://www.npmjs.com/package/@opentelemetry/resource-detector-github), to determine if it's running in [Renovate's GitHub Action](https://github.com/renovatebot/github-action/), or via the npm package in GitHub Actions
- `AWSDetector` from [@opentelemetry/resource-detector-aws](https://www.npmjs.com/package/@opentelemetry/resource-detector-aws) Users hosting on AWS
- `GcpDetector` from [@opentelemetry/resource-detector-gcp](https://www.npmjs.com/package/@opentelemetry/resource-detector-gcp) Users hosting on GCP
- `AzureDetector` from [@opentelemetry/resource-detector-azure](https://www.npmjs.com/package/@opentelemetry/resource-detector-azure) Users hosting on Azure

## Supported OTLP data

### Traces

Renovate provides instrumentation through traces for (non-exhaustively):

- HTTP requests, via [@opentelemetry/instrumentation-http](https://www.npmjs.com/package/@opentelemetry/instrumentation-http)
- A trace for each "splits" Renovate performs - `init`, `extract`, `lookup` and `update`
- Any command execution (`rawExec: ...`)
- Any Git operations
- Per-manager traces when performing the `lookup` and `extract` splits
- Per-branch traces when performing the `update` split
- Important functions (more instrumentation be added)

As well as following [OpenTelemetry's semantic conventions](https://opentelemetry.io/docs/specs/semconv/) where possible, Renovate defines several Custom Attributes, which can be found in [`lib/instrumentation/types.ts`](https://github.com/renovatebot/renovate/blob/main/lib/instrumentation/types.ts).

### Metrics

Renovate does not currently support metrics in an OTLP format.

However, as seen in the [OpenTelemetry examples page](examples/opentelemetry.md), it is possible to use the [spanmetrics connector](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/connector/spanmetricsconnector) to automagically generate metrics from the tracing support Renovate has.

### Logs

Renovate does not currently support logging in an OTLP format.

## Debugging

To help you debug, you can print the telemetry to the console.
Use the environment variable `RENOVATE_TRACING_CONSOLE_EXPORTER`.

## Help wanted

We're continually looking to improve Renovate's instrumentation, and are aware there may be gaps in instrumentation.

As with the rest of Renovate, any additional contributions are very welcome!

You can see our current planned TODO list using [the `core:instrumentation` label](https://github.com/renovatebot/renovate/issues?q=state%3Aopen%20label%3Acore%3Ainstrumentation).
