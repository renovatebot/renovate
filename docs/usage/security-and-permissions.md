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

#### Security awareness for self-hosted Renovate instances

##### Introduction

Before you start self-hosting Renovate you must understand the security implications associated with monitoring and updating repositories.
The process that Renovate uses to update dependencies runs under the same user context as the Renovate process itself.
This also means the process has the same level of access to information and resources as the user context!

##### Trusting Repository Developers

All self-hosted Renovate instances must operate under a trust relationship with the developers of the monitored repositories.
This has the following implications:

- Access to information
- Execution of code

Keep reading to learn more.

###### Access to information

Since the update process runs with the _same_ user privileges as the Renovate process, it inherently has access to the same information and resources.
This includes sensitive data that may be stored within the environment where Renovate is hosted.

###### Execution of code

In certain scenarios, code from the monitored repository is executed as part of the update process.
This is particularly true during, for example:

- `postUpgradeTasks`, where scripts specified by the repository are run
- when a wrapper within the repository is called, like `gradlew`

These scripts can contain arbitrary code.
This may pose a significant security risk if the repository's integrity is compromised, or if the repository maintainers have malicious intentions.

Because such insider attack is an inherent and unavoidable risk, the Renovate project will not issue CVEs for such attacks or weaknesses other than in exceptional circumstances.

##### Centralized logging and sensitive information management

Centralized logging is key to monitor and troubleshoot self-hosted Renovate environments.
But logging may inadvertently capture and expose sensitive information.
Operations that involve `customEnvVariables`, among others, could expose sensitive data, when logging is used.

##### Recommendations

The Renovate maintainers recommend you follow these guidelines.

###### Vet and monitor repositories

_Before_ integrating a repository with your self-hosted Renovate instance, thoroughly vet the repository for security and trustworthiness.
This means that you should review the:

- repository's ownership
- contribution history
- open issues
- open pull requests

###### Limit permissions

Configure the environment running Renovate with the principle of least privilege.
Ensure that the Renovate process has only the permissions needed to perform its tasks and no more.
This reduces the impact of any malicious code execution.

###### Regularly review post-upgrade tasks

Regularly review the actions taken by `postUpgradeTasks` to make sure they do not execute unnecessary or risky operations.
Consider implementing a review process for changes to these tasks within repositories.

###### Use security tools

Employ security tools and practices, like code scanning and vulnerability assessments, on the Renovate configuration _and_ the repositories Renovate manages.
This helps identify potentially malicious code before it is executed.

###### Securing environment variables

When configuring `customEnvVariables`: _always_ use Renovate's secrets management syntax `({{ secrets.VAR_NAME }})` to reference sensitive variables securely.
This makes sure that sensitive data is not exposed as plain text.

###### Logging infrastructure security

Ensure that the logging infrastructure is configured to handle logs as sensitive data.
This includes measures like:

- log encryption
- access controls to restrict log viewing to authorized personnel only
- secure storage and transmission of log data

###### Log review and redaction processes

Implement rigorous log review mechanisms to regularly scan for and redact sensitive information that might be logged inadvertently.
Automated tools can assist in identifying patterns indicative of sensitive data, such as credentials or personal information, enabling timely redaction or alerting.

###### Stay informed

Keep abreast of updates and security advisories related to Renovate itself.
Apply updates promptly to ensure that your self-hosted instances get the latest security enhancements and bug fixes.

#### Conclusion

The flexibility and power of self-hosting Renovate also means you must take steps to manage your security.
By understanding the risks associated with repository management and taking steps to mitigate those risks, organizations can maintain a secure and efficient development workflow.

### Hosted/SaaS (the Mend Renovate App)

Users of the Mend Renovate App fall under [Mend's Terms of Service](https://www.mend.io/terms-of-service/) and Privacy Policy.

In this case the app needs to temporarily clone source code for Renovate to run, but the app does not keep the source code anywhere after jobs are completed.

Mend anonymizes and aggregates package use and update success rates within the hosted app to derive Merge Confidence scores.

The app database keeps a list of dependencies and versions per repo, plus basic into about any Renovate PRs it's created.
