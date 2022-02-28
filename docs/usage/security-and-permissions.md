# Security and Permissions

## Global Permissions

| Permission        | Renovate hosted app |  Forking Renovate  | Why                                                           |
| ----------------- | :-----------------: | :----------------: | ------------------------------------------------------------- |
| Dependabot alerts |       `read`        |       `read`       | Create vulnerability fix PRs                                  |
| Administration    |       `read`        |       `read`       | Read branch protections and to be able to assign teams to PRs |
| Metadata          |       `read`        |       `read`       | Mandatory for all apps                                        |
| Checks            | `read` and `write`  |   not applicable   | Read and write status checks                                  |
| Code              | `read` and `write`  |       `read`       | Read for repository content and write for creating branches   |
| Commit statuses   | `read` and `write`  | `read` and `write` | Read and write commit statuses for Renovate PRs               |
| Issues            | `read` and `write`  | `read` and `write` | Create dependency dashboard or Config Warning issues          |
| Pull Requests     | `read` and `write`  | `read` and `write` | Create update PRs                                             |
| Workflows         | `read` and `write`  |   not applicable   | Explicit permission needed in order to update workflows       |

## User permissions

Renovate can also request users's permission to the following resources.
These permissions will be requested and authorized on an individual-user basis.

| Permission | Renovate hosted app | Forking Renovate | Why                                                      |
| ---------- | :-----------------: | :--------------: | -------------------------------------------------------- |
| email      |       `read`        |       N/A        | Per-user consent requested if logging into App dashboard |
