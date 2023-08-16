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

We apply the Principle of Least Privilege (PoLP) but do need substantial privileges in order for our apps to work.

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
| Issues            |  `read` and `write`   | `read` and `write` | Create dependency dashboard or Config Warning issues          |
| Pull Requests     |  `read` and `write`   | `read` and `write` | Create update PRs                                             |
| Workflows         |  `read` and `write`   |   not applicable   | Explicit permission needed in order to update workflows       |

### User permissions

Renovate can also request users's permission to the following resources.
These permissions will be requested and authorized on an individual-user basis.

| Permission | The Mend Renovate App | Forking Renovate | Why                                                      |
| ---------- | :-------------------: | :--------------: | -------------------------------------------------------- |
| email      |        `read`         |  not applicable  | Per-user consent requested if logging into App dashboard |

## Privacy

I guess that The Mend Renovate App users fall under [Mend's Terms and Conditions](https://www.mend.io/free-developer-tools/terms-of-use/) and Mend's Privacy Policy??????

We also need to distinguish between users who self-host the OSS version, and users on the Mend Renovate App.

### Answer from rarkins in a Discussion

Your understanding appears to be correct.
I will elaborate below.

Let's start with Renovate OSS, which is at the core.
It sends no telemetry, sends only the absolutely required data for the task of checking for updates from repositories.
It can operate disconnected from the internet e.g. talking only to Artifactory.

Renovate On-Prem is a proprietary but free wrapper of Renovate OSS, so it shares these same characteristics.
Although per my memory the terms and conditions say that telemetry may be collected for the purposes of improving the product etc., today it does not - there's no "phone home" for any reason including license validation (which is done locally).

In general I would say that neither product cares about or sends personal data, although of course in some package ecosystems you might see usernames _of packages_ in the names, such as `@rarkins/test` on npm, or `github.com/rarkins/test` on GitHub.

### Does `minimumReleaseAge` send data to Mend or others?

`minimumReleaseAge` does not send any data to Mend or others, it uses the release timestamp from the registry for each version.

### Does the Mend Hosted App store source code?

Source code is not stored, other than the temporary clone.

The app doesn't keep or cache any repo data between runs.
The backend database keeps a list of dependencies and versions per repo, plus basic into about any Renovate PRs it's created.
