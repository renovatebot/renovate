# Use Cases

This page describes common use cases for Renovate, for those who are new and would like to get their heads around the capabilities.

## Development dependency updates

The original use case, and the most popular one, is for developers to automate dependency updating in their software projects.

### Updating of package files

The term "package file" is used to describe files which contain lists of dependencies, managed by a "package manager".
Example package files include `package.json` (managed by npm or Yarn), `Gemfile` (managed by Bundler), or `go.mod` (managed by `go` modules).

Renovate scans repositories to detect package files and their dependencies, checks if any newer versions exist, and then raises Pull Requests for available updates.
The Pull Requests patch the package files directly, and include Release Notes for the newer versions (if they are available).

By default, you'll get separate Pull Requests for each dependency, and major updates will be separated out from non-major.

### Package managers with lock files

Many package managers support "lock files", which "freeze" the entire dependency tree including transitive dependencies.
npm, Yarn, Bundler, Composer, Poetry, Pipenv, and Cargo all support or use lock files.

When lock files exist, changes to package files must come with a compatible change to the associated lock file.
Renovate can patch/update package files directly, but a lock file is too complex to "reverse engineer" so therefore Renovate lets the package manager itself do the lock file update.
A simplified example:

1. The repository has a `package.json` and `package-lock.json` containing version `1.0.0` of a dependency
1. Renovate sees that version `1.1.0` is available
1. Renovate patches the `package.json` to change the dependency's version from `1.0.0` to `1.1.0`
1. Renovate runs `npm install` to let `npm` update the `package-lock.json`
1. Renovate commits the `package.json` and `package-lock.json`
1. Renovate creates the PR

### Custom dependency extraction

Renovate supports 60+ types of package files, but sometimes dependencies are not detected by Renovate by default due to either:

- The package manager/file format is not yet supported, or
- The file format is not a standard or is proprietary

In these cases you can use our "regex" manager to set your own custom patterns to extract dependencies.
You can configure the regex manager by telling it:

- Which file pattern(s) to match
- How to identify the dependency name and version from within the file
- Which datasource (e.g. Docker registry, npm registry, etc) to use to look up new versions

The end result is that Renovate can keep dependencies in custom file formats up-to-date as long as the dependency datasource is known to Renovate.

## DevOps tooling

Renovate is increasingly used for purposes which are traditionally described as DevOps instead of Developer.

### DevOps / Infrastructure as Code updates

Repositories today consist of more than just development dependencies, and commonly include DevOps-related files like CI/CD configs or "Infrastructure as Code" (IaC) files like Docker, Kubernetes or Terraform files.
Renovate considers these all to be forms of "package managers" and "package files" and therefore detects and updates them accordingly.

Docker-compatible images are one of the key building blocks of modern software and so are most commonly found, in both CI/CD pipeline configs as well as referenced in IaC files.
Renovate will detect these IaC files and then query Docker registries to determine if newer tags or digests exists.

An example of tag-based updating would be `node` images from Docker Hub.
These are typically tagged using their version, like `14.17.4` but can also have more elaborate tags like `14.17.4-alpine3.11`.
Renovate handles both these tag scenarios and will propose updates such as from `14.17.4` to `14.7.5`, or from `14.17.4-alpine3.11` to `14.17.5-alpine3.11`.

A better example of Renovate's power is when updating Docker digests.
While humans could be reasonably expected to check and update versions like `14.17.4`, looking up image digests and updating them manually is impractical to do at scale.
Renovate can not only keep Docker digests updated, but it can even be configured to "pin" digests from being tag-based to being tag+digest based to get immutable builds.

### Internal package updates

Companies typically have at least dozens of repositories, if not hundreds or thousands.
In most cases, these repositories do not operate in isolation and may have upstream or downstream internal dependencies.
In such cases, it is best practice to:

- Update downstream links as soon as possible, and
- Keep internal version use as consistent as possible

Renovate is often used to achieve both the above best practices by detecting and updating internal dependencies just like external or Open Source dependencies.

An example from Renovate itself is the use of submodule updating to automate the process of updating Renovate's documentation:

- Renovate's main repository [`renovatebot/renovate`](https://github.com/renovatebot/renovate) contains the majority of Markdown documentation files
- Renovate's documentation build repository [`renovatebot/renovatebot.github.io`](https://github.com/renovatebot/renovatebot.github.io) contains a submodule link to `renovatebot/renovate`
- Submodule updates are performed automatically whenever detected
- After the automatic update is merged, the documentation site is rebuilt and pushed live

The above use case makes use of Renovate's "automerge" feature, which allows for fully automated updates without needing manual approval, merging, or even a PR at all if desired.
Automerge is particularly useful for internal dependencies when it's best to use the approach of "if it passes tests then merge it".

To learn more about "automerge" read the [key concepts, automerge](https://docs.renovatebot.com/key-concepts/automerge/) documentation.

## Advanced configuration

The below capabilities are common across the above use cases.

### Batched updates

Renovate defaults to separating each dependency update into its own PR, but some users prefer to batch or "group" updates together.
For example, group all patch updates into one PR or even perhaps all non-major updates together (patches and minor updates).

Renovate supports this capability using the `groupName` configuration as part of `packageRules`.

### Scheduled updates

Some users prefer to limit which hours of the day or week during which Renovate will raise updates.
This may be to reduce "noise" during working hours, but also to reduce the chance of CI contention at times when developers are likely to be waiting on tests to finish.

Renovate allows users to define time ranges during which to create updates using the `schedule` field.

### On-demand updates

Renovate's "Dependency Dashboard" capability can be used on platforms which support dynamic Markdown checkboxes (GitHub, GitLab, and Gitea).
When enabled, an issue titled "Dependency Dashboard" is created which lists all updates which are pending, in progress, or were previously closed ignored.

Importantly, it also enables the concept of "Dependency Dashboard Approval", meaning that configured PRs won't be raised automatically and will instead only be created once the corresponding checkbox is clicked on the dashboard.
This can be an improvement in two ways:

- By not raising PRs automatically, it can allow users to request them on-demand at times when they are ready to take action on them, and
- Offering an alternative to permanently ignoring/disabling certain types of updates, such as major updates

By having this dashboard concept it gives users both visibility and control over updates.

### Configuration presets

It's common that users run Renovate on many repositories and therefore want a (mostly) similar config across their repositories.
Renovate supports the concept of configuration "presets" to avoid users needing to duplicate configuration across all such repos.

Configuration presets are JSON configuration files which are committed to repositories and then referenced from others.
Renovate also includes over 100 built-in presets, including the default recommended `config:base` preset.

The typical workflow for a company is:

- Create a dedicated repository to store the company's default Renovate settings
- Set that repository as the default `extends` value when onboarding new repositories

This means that repositories get the centralized config by default, and any changes made to the centralized config repository are propagated to other repositories immediately.
