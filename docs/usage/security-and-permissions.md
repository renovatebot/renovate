# Security and Permissions

## Comparison table

Refer to this table for a overview of the permissions needed for the different ways to run Renovate:

| Permission name   | Renovate hosted app |  Forking Renovate  |
| ----------------- | :-----------------: | :----------------: |
| Dependabot alerts |       `read`        |       `read`       |
| Administration    |       `read`        |       `read`       |
| Metadata          |       `read`        |       `read`       |
| Checks            | `read` and `write`  |   not applicable   |
| Code              | `read` and `write`  |       `read`       |
| Commit statuses   | `read` and `write`  | `read` and `write` |
| Issues            | `read` and `write`  | `read` and `write` |
| Pull Requests     | `read` and `write`  | `read` and `write` |
| Workflows         | `read` and `write`  |   not applicable   |
| Deployments       |   not applicable    |       `read`       |

## List of permissions

### Renovate hosted app

The Renovate hosted app needs the following permissions.

`read` access to:

- Dependabot alerts
- administration
- metadata

`read` and `write` access to:

- checks
- code
- commit statuses
- issues
- pull requests
- workflows

### Forking renovate

The `forking-renovate` app needs the following permissions.

`read` access to:

- Dependabot alerts
- administration
- code
- deployments
- metadata

`read` and `write` access to:

- commit statuses
- issues
- pull requests
