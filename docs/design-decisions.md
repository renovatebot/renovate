# Design Decisions

This file documents the design choices as well as configuration options.

#### Stateless

No state storage is needed on `renovate` or the source code repository apart
from what you see publicly (branches, Pull Requests). It therefore doesn't
matter if you stop/restart the script and would even still work if you had it
running from two different locations, as long as their configuration was the
same.

#### API only

So far, nothing we need to do requires a full `git clone` of the repository.
e.g. we do not need to perform a git clone of the entire repository. Therefore,
all operations are performed via the API.

## Synchronous Operation

The script current processes repositories, package files, and dependencies
within them all synchronously.

- Greatly reduces chance of hitting simultaneous API rate limits
- Simplifies logging

Note: Initial queries to NPM are done in parallel.

## Multiple Configuration Methods

The script supports multiple [configuration methods](configuration.md)
concurrently, and processed in order of priority. This allows examples such as
token configured via environment variable and labels configured via target
`package.json`.

## Cascading Configuration

Configuration options applied per-package (e.g. with package rules) override those applied per
package-type, which override those per-repository, which override those which
are global (all repositories).

## Automatic discovery of package.json locations

Default behaviour is to auto-discover all `package.json` locations in a
repository and process them all. Doing so means that "monorepos" are supported
by default. This can be overridden by the configuration option `includePaths`,
where you list the file paths manually (e.g. limit to just `package.json` in
root of repository).

## Separate Branches per dependency

By default, `renovate` will maintain separate branches per-dependency. So if 20
dependencies need updating, there will be at least 20 branches/PRs. Although
this may seem undesirable, it was considered even less desirable if all 20 were
in the same Pull Request and it's up to the users to determine which dependency
upgrade(s) caused the build to fail.

However, it's still possible to override the default branch and PR name
templates in such a way to produce a single branch for all dependencies. The
`groupName` configuration option can be used at a repository level (e.g. give it
the value `All`) and then all dependency updates will be in the same branch/PR.

## Separate Minor and Major PRs

`renovate` will create multiple branches/PRs if both major and minor branch upgrades
are available. For example if the current example is 1.6.0 and upgrades to 1.7.0
and 2.0.0 exist, then `renovate` will raise PRs for both the 1.x upgrade(s) and
2.x upgrade(s).

- It's often the case that projects can't upgrade major dependency versions
  immediately.
- It's also often the case that previous major versions continue receiving Minor
  or Patch updates.
- Projects should get Minor and Patch updates for their current Major release
  even if a new Major release exists

This can be overridden via the config option `separateMajorMinor`.

## Branch naming

Branches are named like `renovate/webpack-1.x` instead of
`renovate/webpack-1.2.0`.

- Branches often receive updates (e.g. new patches) before they're merged.
- Naming the branch like `1.x` means its name still names sense if a `1.2.1`
  release happens

Note: Branch names are configurable using string templates.

## Pull Request Recreation

By default, the script does not create a new PR if it finds an identical one
already closed. This allows users to close unwelcome upgrade PRs and worry about
them being recreated every run. Typically this is most useful for major
upgrades. This option is configurable.

## Rebasing Unmergeable Pull Requests

With the default behaviour of one branch per dependency, it's often that case
that a PR gets merge conflicts after an adjacent dependency update is merged.
Although platforms often have a web interface for simple merge conflicts, this is
still annoying to resolve manually.

`renovate` will rebase any unmergeable branches and add the latest necessary
commit on top of the most recent `master` commit.

Note: `renovate` will only do this if the original branch hasn't been modified
by anyone else.

## Suppressing string templates from CLI

String templates (e.g. commit or PR name) are not configurable via CLI options,
in order to not pollute the CLI help and make it unreadable. If you must
configure via CLI, use an environment variable instead. e.g.

```sh
$ RENOVATE_BRANCH_NAME=foo renovate
```

Alternatively, consider using a Configuration File.

## Logging and error levels

Renovate uses the following convention for log levels:

- logger.error should only be used for problems that are likely to be a Renovate bug or require Renovate improvements. These are the types of errors that Renovate administrators should be alerted to immediately
- logger.warn should be used for problems that might be a Renovate problem so should be checked periodically in batches
- For _user_ problems (e.g. configuration errors), these should not warn or error on the server side and instead use logger.info
