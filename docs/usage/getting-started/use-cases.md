# Use Cases

This page describes common use cases for Renovate.

## Development dependency updates

The original use case, and the most popular one, is for developers to automate dependency updating in their software projects.

### Updating of package files

We use the term "package file" to describe files which have references to dependencies.
Package files are managed by a "package manager".

Example package files include:

- `package.json`, managed by npm or Yarn
- `Gemfile`, managed by Bundler
- `go.mod`, managed by `go` modules

#### How Renovate updates a package file

Renovate:

1. Scans your repositories to detect package files and their dependencies
1. Checks if any newer versions exist
1. Raises Pull Requests for available updates

The Pull Requests patch the package files directly, and include Release Notes for the newer versions (if they are available).

By default:

- You'll get separate Pull Requests for each dependency
- Major updates are kept separate from non-major updates

### Package managers with lock files

Many package managers support "lock files", which "freeze" the entire dependency tree including transitive dependencies.
npm, Yarn, Bundler, Composer, Poetry, Pipenv, and Cargo all support or use lock files.

If you use a lock file then changes to your package file must come with a compatible change to the lock file.
Renovate can patch/update package files directly, but a lock file is too complex to "reverse engineer".
This is why Renovate lets the package manager do the lock file update.
A simplified example:

1. The repository has a `package.json` and `package-lock.json` with version `1.0.0` of a dependency
1. Renovate sees that version `1.1.0` is available
1. Renovate patches the `package.json` to change the dependency's version from `1.0.0` to `1.1.0`
1. Renovate runs `npm install` to let `npm` update the `package-lock.json`
1. Renovate commits the `package.json` and `package-lock.json`
1. Renovate creates the PR

### Custom dependency extraction

Renovate supports 60+ types of package files.
Not all dependencies are detected by default, this can be because:

- The package manager/file format is not supported, or
- The file format is not a standard or is proprietary

If your dependencies are not detected by default, you can use our "regex" manager to set your own custom patterns to extract dependencies.
You configure the regex manager by telling it:

- Which file pattern(s) to match
- How to find the dependency name and version from within the file
- Which datasource (e.g. Docker registry, npm registry, etc) to use to look up new versions

The end result is that Renovate can keep dependencies in custom file formats up-to-date as long as the dependency datasource is known to Renovate.

## DevOps tooling

Renovate is increasingly used for purposes which are traditionally described as DevOps instead of Developer.

### DevOps / Infrastructure as Code updates

It's common for repositories to have DevOps-related files like CI/CD configs, or "Infrastructure as Code" (IaC) files.
Examples of IaC files are Docker, Kubernetes or Terraform files.
Renovate handles IaC files as "package managers" and "package files" and can detect and update them.

#### Docker-compatible images

Docker-compatible images are a key building block of modern software.
These images are commonly found in CI/CD pipeline configs or referenced in IaC files.
Renovate finds these IaC files and then searches Docker registries to see if there are newer tags or digests.

#### Tag-based updating

An example of tag-based updating are `node` images from Docker Hub.
The `node` images use these tag formats:

- `14.17.4`
- `14.17.4-alpine3.11`

Renovate understands both formats and raises updates like these:

- From `14.17.4` to `14.17.5`
- From `14.17.4-alpine3.11` to `14.17.5-alpine3.11`

#### Docker digests

You can check and update versions like `14.17.4` yourself.
But looking up image digests like `341976f40d963a425d627a349a9b0034e1eafffbf4c82a173c1465ee403878d9` and updating them yourself doesn't scale.
So let Renovate update your Docker digests.

You can even configure Renovate to "pin" your Docker digests.
When you're using tag+digest based images, you'll have immutable builds.

### Internal package updates

Your company typically has dozens of repositories, if not hundreds or thousands.
These repositories usually rely on other repositories and may have upstream or downstream internal dependencies.
In such cases, it is best practice to:

- Update downstream links as soon as possible, and
- Keep internal version use as consistent as possible

You can use Renovate to follow this best practice.
Renovate finds and updates internal dependencies just like external or Open Source dependencies.

#### Example of internal package update

We automatically update our documentation site with Renovate bot.
We use Renovate's git submodule support to do this.

- Our main repository [`renovatebot/renovate`](https://github.com/renovatebot/renovate) has most of the Markdown documentation files
- The documentation build repository [`renovatebot/renovatebot.github.io`](https://github.com/renovatebot/renovatebot.github.io) has a submodule link to our main repository `renovatebot/renovate`
- Submodule updates are performed automatically whenever detected
- After the automatic update is merged, the documentation site is rebuilt and pushed live

We also use Renovate's "automerge" feature.
It allows us to automatically merge the submodule update without needing manual approval, manual merging, or even without getting a PR at all.

Automerge is particularly useful for internal dependencies where it's best to use the approach of "if it passes tests then merge it".

To learn more about "automerge" read the [key concepts, automerge](https://docs.renovatebot.com/key-concepts/automerge/) documentation.

## Advanced configuration

The capabilities listed below are commonly needed for all the above use cases.

### Batched updates

Renovate defaults to separating each dependency update into its own PR.
But you may want to batch or "group" updates together.
For example, group all patch updates into one PR or even all non-major updates together (patches and minor updates).

You can configure batched updates by setting a `groupName` as part of `packageRules`.

### Scheduled updates

You may want to limit the times when Renovate is allowed to raise updates.
This reduces "noise" during your working hours, and reduces the chance of CI contention.
You can tell Renovate to "not bother you" during times when you're using the CI resources, or want to focus on your work.

You can set the time ranges during which Renovate creates updates in the `schedule` field.

### On-demand updates via Dependency Dashboard

You can use Renovate's "Dependency Dashboard" on platforms which support dynamic Markdown checkboxes:

- GitHub
- GitLab
- Gitea

When you enable the Dependency Dashboard, Renovate creates a "Dependency Dashboard" issue.
This issue lists all updates which are pending, in progress, or were previously closed ignored.

If you want to get an update ahead of schedule, or want to retry a previously closed update, you can click on the update's checkbox in the Dependency Dashboard.

### Dependency Dashboard Approval

If you enable the Dependency Dashboard you can opt-in to a different workflow for some, or even all of your packages.
We call this the "Dependency Dashboard Approval" workflow.

Here's how it works:

- You tell Renovate which package updates need "Dashboard Approval" by setting a custom `packageRule`
- Renovate only raises updates for packages that need "Dashboard Approval" after you click on the corresponding checkbox on the dashboard

#### Benefits of using Dependency Dashboard Approval

Benefits of using Dependency Dashboard Approval:

- By not raising PRs automatically, it allows you to request updates on-demand when you're ready, and
- It offers you an alternative to permanently ignoring/disabling certain types of updates, like major updates

When you use the Dependency Dashboard Approval workflow you have full visibility and control over your updates.

### Configuration presets

You may run Renovate on many, or even all your repositories.
This also means that you might want a similar config for all of your repositories.
You can use configuration "presets" to avoid duplicating your configuration across your repositories.

Configuration presets are JSON configuration files which are committed to repositories and then referenced from others.
Renovate includes over 100 built-in presets, like the default recommended `config:base` preset.

The typical workflow for a company is:

- Create a dedicated repository to store the company's default Renovate settings
- Set that repository as the default `extends` value when onboarding new repositories

This means that repositories get the centralized config by default, and any changes made to the centralized config repository are propagated to other repositories immediately.

## How others use Renovate

You can learn a lot by seeing how others use Renovate.
Check out the [Swissquote user story](../user-stories/swissquote.md).
