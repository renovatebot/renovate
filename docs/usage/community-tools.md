# Community Tools

This page lists community-maintained tools that extend or complement Renovate.
These tools are not officially supported by the Renovate team, but may be useful for your workflow.

<!-- prettier-ignore -->
!!! note
    If you have a community tool you'd like to add to this page, please open a pull request.

## Renovate Operator (Kubernetes)

The [Renovate Operator](https://github.com/mogenius/renovate-operator) lets you run Renovate on Kubernetes in a native way.
It wraps the Renovate CLI in a Kubernetes operator and adds features like:

- CRD-based scheduling with declarative cron syntax
- Parallel execution with configurable concurrency control
- Auto-discovery of repositories
- Built-in web dashboard for monitoring and management
- Webhook API for on-demand runs
- Prometheus metrics and health checks

## `renovate-pretty-log-tui`

[`renovate-pretty-log-tui`](https://gitlab.com/tanna.dev/renovate-pretty-log/) is a Terminal User Interface (TUI) to provide a richer, local-only view, for your Renovate debug logs.

## DepCast

[DepCast](https://github.com/ahafarag/depcast) is a companion GitHub Actions integration that scores every Renovate-opened upgrade PR using the Compatibility Risk Score (CRS) — a four-signal model derived from an empirical study of 346 breaking npm/PyPI/pub.dev releases (AUC-ROC = 0.853).

For each Renovate PR it:

- Labels the PR `depcast:safe` / `depcast:wait` / `depcast:avoid`
- Posts a signal breakdown comment (API volatility, downstream exposure, observed failure rate, maintainer history)
- Blocks merge (via `request_changes`) for AVOID-rated releases (CRS ≥ 0.60)
- Optionally emits anonymized outcome signals to build live upgrade-failure statistics

**Setup:** copy one workflow file — no `renovate.json` changes required:

```bash
mkdir -p .github/workflows
curl -sSL https://raw.githubusercontent.com/ahafarag/depcast/main/packages/depcast-consumer/consumer-workflow-template.yml \
  -o .github/workflows/depcast-consumer.yml
```

See the [integration guide](https://github.com/ahafarag/depcast/blob/main/docs/renovate-integration.md) for full docs.
