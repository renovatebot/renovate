# Security and Permissions

## How we keep Renovate safe to use

...

## Permission comparison

| Permission        | Renovate hosted app |  Forking Renovate  | Why                                                 |
| ----------------- | :-----------------: | :----------------: | --------------------------------------------------- |
| Dependabot alerts |       `read`        |       `read`       | Create security updates                             |
| Administration    |       `read`        |       `read`       | ...                                                 |
| Metadata          |       `read`        |       `read`       | Get basic repository information                    |
| Checks            | `read` and `write`  |   not applicable   | ...                                                 |
| Code              | `read` and `write`  |       `read`       | Find Renovate config file and package manager files |
| Commit statuses   | `read` and `write`  | `read` and `write` | ...                                                 |
| Issues            | `read` and `write`  | `read` and `write` | Create dependency dashboard                         |
| Pull Requests     | `read` and `write`  | `read` and `write` | Create update PRs                                   |
| Workflows         | `read` and `write`  |   not applicable   | Update dependencies in workflow files               |
| Deployments       |   not applicable    |       `read`       | ...                                                 |
