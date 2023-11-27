# Security and Permissions

This page talks about our security stance, and explains what permissions are needed for the different ways you can run Renovate.

## Security Stance

Renovate is open source software, and comes with no guarantees or warranties of any kind.
That said, we will try to fix security problems in a reasonable timeframe if possible.

### Certifications

Renovate the open source project is **not** certified.

Mend is the company which maintains Renovate and provides the Mend Renovate App.
Mend is ISO 27001 and SOC2 certified.

### Security / Disclosure

If you find any bug with Renovate that may be a security problem, then e-mail us at: [renovate-disclosure@mend.io](mailto:renovate-disclosure@mend.io).
This way we can evaluate the bug and hopefully fix it before it gets abused.
Please give us enough time to investigate the bug before you report it anywhere else.

Please do not create GitHub issues for security-related doubts or problems.

## Permissions

We apply the Principle of Least Privilege (PoLP) but do need substantial privileges for our apps to work.

### Global Permissions

These permissions are always needed to run the respective app.

| Permission        | The Mend Renovate App |  Forking Renovate  | Why                                                           |
| ----------------- | :-------------------: | :----------------: | ------------------------------------------------------------- |
| Dependabot alerts |        `read`         |       `read`       | Create vulnerability fix PRs                                  |
| Administration    |        `read`         |       `read`       | Read branch protections and to be able to assign teams to PRs |
| Metadata          |        `read`         |       `read`       | Mandatory for all apps                                        |
| Checks            |  `read` and `write`   |   not applicable   | Read and write status checks                                  |
| Code              |  `read` and `write`   |       `read`       | Read for repository content and write for creating branches   |
| Commit statuses   |  `read` and `write`   | `read` and `write` | Read and write commit statuses for Renovate PRs               |
| Issues            |  `read` and `write`   | `read` and `write` | Create Dependency Dashboard or Config Warning issues          |
| Pull Requests     |  `read` and `write`   | `read` and `write` | Create update PRs                                             |
| Workflows         |  `read` and `write`   |   not applicable   | Explicit permission needed to update workflows                |

### User permissions

Renovate can also request users's permission to the following resources.
These permissions will be requested and authorized on an individual-user basis.

| Permission | The Mend Renovate App | Forking Renovate | Why                                                      |
| ---------- | :-------------------: | :--------------: | -------------------------------------------------------- |
| email      |        `read`         |  not applicable  | Per-user consent requested if logging into App dashboard |

## Privacy

### Self-hosted (Renovate OSS CLI, Mend Renovate On-Premises)

Renovate is designed to operate autonomously and directly with package and source repositories, so does not "phone home", send telemetry, or need to request information from Mend or any project infrastructure.
An exception to this is when Merge Confidence badges are requested, because those are hosted on Mend servers.
Such badges are public, do not require authentication, and Renovate does not identify the source user or repository when requesting them.
Self-hosted Renovate does not send or submit any package data to Mend for the purpose of calculating Merge Confidence figures.

According to a strict definition, Renovate may "send data" to third-party registries and source code hosts directly to look up new releases.
For example, if you have an `npm` package and do not configure a private registry then Renovate will query URLs on `https://registry.npmjs.org` including names of packages used in your repositories.
You could avoid this by configuring private registries but such registries need to query public registries anyway.
We don't know of any public registries which reverse lookup IP addresses to associate companies with packages.

### Hosted/SaaS (the Mend Renovate App)

Users of the Mend Renovate App fall under [Mend's Terms of Service](https://www.mend.io/terms-of-service/) and Privacy Policy.

In this case the app needs to temporarily clone source code for Renovate to run, but the app does not keep the source code anywhere after jobs are completed.

Mend anonymizes and aggregates package use and update success rates within the hosted app to derive Merge Confidence scores.

The app database keeps a list of dependencies and versions per repo, plus basic into about any Renovate PRs it's created.
