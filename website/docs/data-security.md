---
title: Data Security and Handling
description: Important information about how we handle and secure you data
---

# Data Security and Handling

We consider it a great responsibility that you have trusted us with your GitHub repository/data, and we take it very seriously. Although installing an App may take just a few clicks, we think it's important that you know what happens to your repository data once you install the Renovate or Forking Renovate apps.

The content in this document does not replace or override anything in our [Privacy Policy](https://renovatebot.com/privacy). We provide it for your "peace of mind" and with the hope of receiving feedback that may enable us to improve security and data handling even further.

If you have any suggestions or questions about our security, please contact us at security@renovatebot.com immediately. Please do not disclose any security concerns in a public forum.

## GitHub App Private Key

The most important consideration for GitHub App security is the [Private Key](https://developer.github.com/apps/building-integrations/setting-up-and-registering-github-apps/registering-github-apps/#generating-a-private-key) used to access installations. This key is metaphorically the "key to the kingdom" and is essentially the only thing anybody needs to gain access to all repositories on which the Renovate App has been installed, so we have handled it with great caution:

- The key is not saved to disk _anywhere_. We do not keep a backup of it on any device, thumbdrive, or password manager.
- The key is saved in one location - as an [AWS EC2 Parameter Store](http://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html) "Secure String"
- The EC2 instance we run Renovate on gains access to this Secure String using its IAM Role permissions
- The private key is not exposed/saved to "env" at any time
- There exists no generated AWS "Access Key" that has permissions to either (a) read from EC2 Parameter Store, or (b) create IAM users or roles with permissions to access the secure string, or (c) create a new EC2 instance that could gain access
- When the Renovate App runs and decrypts the Private Key, it is stored in memory only as long as necessary to retrieve temporary tokens for each installation, and it is never written to any log

## App Ownership

We have chosen to assign ownership of the apps to the GitHub organization "`renovateapp`". Only two GitHub accounts have admin access to this organization and both are protected by 2 Factor Authentication.

## GitHub Permissions

The Renovate App requires the following GitHub Permissions:

- **Read** access to administration and metadata
- **Write** access to commit statuses
- **Write** access to issues and pull requests
- **Write** access to repository content

The "Forking Renovate" App requires only read-only access to repository content because it submits PRs from its own fork of each repository.

We will explain the need for each of these here:

##### Read access to administration and metadata

This is necessary so that Renovate can learn enough about the repository to detect settings without manual configuration. As an example, this permission is used so Renovate can detect:

- The merge types allowed in the repository (e.g. merge commit, merge squash, rebase)
- Whether the repository status checks require Pull Requests to be up-to-date with base branch before merging

##### **Write** access to commit statuses

Renovate can utilise commit statuses for purposes such as to warn if a package in the current update is canBeUnpublished. For example npm packages can be revoked within the first 24 hours of publication.

##### **Write** access to issues

Renovate makes use of repository issues if it needs to alert of configuration errors. For example, if someone updates the `renovate.json` configuration with invalid JSON that cannot be parsed, Renovate will stop processing the repository and instead raise an "Action Required" issue to alert users to fix it.

##### **Write** access to Pull Requests

This permission is used heavily today, for instance every time Renovate finds an available update to be tested.

##### Write access to repository contents (i.e. code)

Renovate needs write access to code in order to create branches within the repository, or to automerge any updates itself. Although this necessary permission gives us access to _all files in a repository_, we will only write changes to package definitions files (like `package.json` or `Dockerfile`), or lock files like `package-lock.json` and `yarn.lock`. These files may be located in any subdirectory too (e.g. for monorepo configurations).

[Forking Renovate](https://github.com/apps/forking-renovate) does not require write access to repository contents, because it submits PRs from branches within its own forks of repositories.

## Renovate source code

Although the Renovate App runs as a wrapper around the `renovate` open source code in order to schedule repositories and retrieve tokens, the entire logic of the application remains as open source, located at [https://github.com/renovatebot/renovate](https://github.com/renovatebot/renovate). In other words, you can always know what code/logic is running on your repository because we always run the open source code - there is no "fork" of the open source repository in use.

## AWS Region

The Renovate App uses Amazon Web Services (AWS) exclusively for running and monitoring the service. Currently all AWS services we use are located in the `us-west-2` region (Oregon) in order to be close to GitHub's API servers and minimise latency. Also, this means that GitHub data is not crossing any virtual country "boundaries" as it remains in the USA.

## Debugging and Troubleshooting

We do not "let down our guard" on security when things go wrong or need troubleshooting. For example, we will never extract a copy of the GitHub Private Key so that we can run the app "locally" on any developer laptop.

Renovate will always be run from the "production" server and the app's credentials are never be copied off for debugging purposes. We employ detailed logging by default in order to hopefully have enough of a "black box" to know what happened when something went wrong. Also, we are helped by the fact that problems usually repeat (sometimes every time Renovate runs) so this gives us the ability to expand the debug logging of the renovate app itself if previous runs did not give enough detail.

## Log Locations and Retention

All logs are stored in the AWS Oregon region as described above. We currently log to:

- CloudWatch Logs (30 day retention)
- S3 (30 day retention)

Select metadata (such as each run's result/status) is extracted from logs and saved to an RDS Postgres instance with no expiry.

As described above, please be aware that no tokens or "secure" data is saved in these logs.

If you leave the service and wish for us to delete your logs, notify us by email and we will ensure they are all removed within a maximum of 30 days.
