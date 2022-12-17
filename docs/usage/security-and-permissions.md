# Security and Permissions

This page talks about our security stance, and explains what permissions are needed for the different ways you can run Renovate.

## Security Stance

Renovate is open source software, and comes with no guarantees or warranties of any kind.
That said, we will try to fix security problems in a reasonable timeframe if possible.

### Certifications

Renovate the open source project is **not** certified.

The company which maintains Renovate and provides the hosted Renovate App for GitHub is called Mend.
Mend is ISO 27001 and SOC2 certified.

### Security / Disclosure

If you find any bug with Renovate that may be a security problem, then e-mail us at: [renovate-disclosure@mend.io](mailto:renovate-disclosure@mend.io).
This way we can evaluate the bug and hopefully fix it before it gets abused.
Please give us enough time to investigate the bug before you report it anywhere else.

Please do not create GitHub issues for security-related doubts or problems.

## Permissions

We apply the Principle of Least Privilege (PoLP) but do need substantial privileges in order for our apps to work.

### Global Permissions

These permissions are always needed to run the respective app.

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

### User permissions

Renovate can also request users's permission to the following resources.
These permissions will be requested and authorized on an individual-user basis.

| Permission | Renovate hosted app | Forking Renovate | Why                                                      |
| ---------- | :-----------------: | :--------------: | -------------------------------------------------------- |
| email      |       `read`        |  not applicable  | Per-user consent requested if logging into App dashboard |
