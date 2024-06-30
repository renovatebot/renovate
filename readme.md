# What is Renovate?

Renovate is a dependency update tool. It helps to update dependencies in your code to the latest version.
When Renovate runs on your repo, it looks for all known references to external dependencies and, if there are newer versions available, Renovate will create a pull request to update your code directly.

**Features**
- Delivers updates directly to your code base
  - Relevant package files are discovered automatically
  - Pull Requests automatically generated in your repo
- Provides useful information to help you decide which updates to accept (age, adoption, passing, merge confidence)
- Highly configurable - Lots of ways to configure it for your custom needs
- Largest collection of languages and platforms (listed below)
- Connects with private repositories and package registries

**Languages**<br>
Renovate can provide updates for nearly all languages, platforms and registries including: npm, Java, Python, .NET, Scala, Ruby, Go, Docker-hub and more.
Supports over 90 different package managers.

**Platforms**<br>
Renovate updates code repositories on the following platforms: GitHub, GitLab, Bitbucket, AzureDevOps, AWS Code Commit, Gitea, Forgejo, Gerrit (experimental)

#  Ways to Run Renovate

The easiest way to run Renovate is to use a job scheduling system that regularly runs Renovate on all enabled repositories and responds with priority to user activity.

Mend provides pre-built systems for automatically running Renovate on your repositories.

## Mend Renovate App (Cloud)

**Targets: GitHub Cloud, Bitbucket Cloud**<br>
Hosted by Mend.io. No setup required. Community plan available (Free)

* GitHub Cloud: Install the [Renovate App](https://github.com/apps/renovate) on your GitHub org, then select the repos to enable
* Bitbucket Cloud: Add the [Mend App](https://marketplace.atlassian.com/apps/1232072/mend) to your Workspace, the add the Mend Renovate user to the projects you want to enable

## Mend Renovate Server (Self-hosted)

**Targets: GitHub, GitLab, Bitbucket**<br>
Install and run your own Renovate server. Access internal packages.

* [Mend Renovate Community Edition](https://github.com/mend/renovate-ce-ee/tree/main/docs) (Free)
* [Mend Renovate Enterprise Edition](http://link-to-enterprise-webpage) (Paid plan)

## Other ways to run Renovate
If you can’t use a pre-built job scheduling system, or want to build your own, the following options are available:

### Run Renovate on your Pipeline
Mend provides a _**GitHub Action**_ and _**GitLab Runner**_ to make it easier to run Renovate as a CI pipeline job.

* GitHub Action: renovatebot/github-action.
* GitLab Runner: Renovate Runner project
* AzureDevOps action: Renovate Me extension
_Note: This extension is created and maintained personally by a Renovate developer/user so support requests relating to the extension itself cannot be answered directly in the main Renovate repository._
* Custom pipeline: You can create a custom pipeline with a **yml** definition that triggers **npx renovate**. More details on how to configure the pipeline.

### Run Renovate CLI
There are several ways to run the Renovate CLI directly. See docs: Running Renovate for all options.
**Targets: GitHub, GitLab, Bitbucket, AzureDevOps, AWS Code Commit, Gitea, Forgejo, Gerrit (experimental)**

**Run Renovate as an npm command**
```bash
npm install -g renovate
npx renovate -r myorg/myrepo
```

**Run Renovate as a Docker command**
```bash
docker run renovate/renovate -r myorg/myrepo
```

# Docs

### More about Renovate
- Renovate basics
  - Why use Renovate
  - What does it do? / How does it work?
  - Who is using it?
- Supported platforms and languages
  - Supported platforms
  - Supported languages / package managers
- Advanced renovate usage
  - Accessing private packages
  - Monorepo support
  - Merge Confidence data

### Renovate Docs
- Renovate Configuration
- Mend Renovate Server Docs

### Comparisons
- Different ways to run Renovate
- Renovate vs Dependabot Comparison

# Get involved

### Issues and Discussions
We prefer all items to be opened as a discussion before opening an issue.
- GitHub Discussions forum

### Contributing
To contribute to Renovate, or run a local copy, please read the contributing guidelines.
- Guidelines for Contributing
- Items that need contribution: good first issues

### Contact and Social Media
The Renovate project is proudly supported and actively maintained by Mend.io.
- Contact Mend.io for commercial support questions.

Follow us on Twitter, LinkedIn and Mastodon.
- Twitter: x.com/mend_io
- LinkedIn: linkedin.com/company/mend-io

