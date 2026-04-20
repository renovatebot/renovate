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
