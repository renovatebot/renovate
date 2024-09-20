# Adding a Package Manager

This document explains how to add a new package manager.

## Code structure

Code for package managers goes in the `lib/modules/manager/*` directory.
The package manager code is often tightly coupled to the datasource code in `lib/modules/datasource/*`.

Versioning logic like Semver or PEP 440 goes in `lib/modules/versioning/*`.

Common application logic for Renovate, not specific to particular managers, usually lives under `lib/workers/*`.

## Manager requirements

The manager's `index.ts` file supports the following values or functions:

| Value/function                | Optional | Async |
| ----------------------------- | -------- | ----- |
| `bumpPackageVersion`          | yes      |       |
| `extractPackageFile`          |          | yes   |
| `extractAllPackageFiles`      | yes      | yes   |
| `getRangeStrategy`            | yes      |       |
| `categories`                  | yes      |       |
| `supportsLockFileMaintenance` | yes      |       |
| `updateArtifacts`             | yes      | yes   |
| `updateDependency`            | yes      |       |
| `updateLockedDependency`      | yes      |       |

### `bumpPackageVersion` (optional)

Use this function to allow version bumps of updated packages.
For example:

- to increase the version of a Maven module if a package has been updated
- to bump the Helm chart version, if a subchart version has been updated

### `extractPackageFile(content, packageFile, config)` (async, semi-mandatory)

This function is mandatory, unless you use `extractAllPackageFiles` instead.
It takes as arguments the file's content and optionally the file's full file pathname and config.
The function returns an array of detected or extracted dependencies, including the:

- dependency name
- dependency type (dependencies, devDependencies, etc)
- currentValue
- versioning used (like SemVer, PEP 440)

The `extractPackageFile` function doesn't need to fully _understand_ the file or syntax that it gets.
It needs to understand enough to extract a correct list of dependencies.

In general, we extract _all_ dependencies from each dependency file, even if they have values we don't support.

If the function reads parts of a dependency file that it can't parse, it should give a `skipReason` message to the `extractPackageFile` function.
Make sure the `skipReason` message is helpful to someone reading the logs.

If `extractPackageFile` is passed a file which is a "false match", so not a package file, or a file with no dependencies then it can return `null`.
Downstream this results in the file being ignored and removed from the list of package files.

### `extractAllPackageFiles(packageFiles)` (async, optional)

Normally a package manager parses or extracts all package files in _parallel_, and can thus use the `extractPackageFile` function.
If the package manager you're adding works in _serial_, use this function instead.

For example the npm and Yarn package manager must process the `package.json` and `package-lock` or `yarn.lock` files together.
This allows features like Workspaces to work.
This means that for npm or Yarn we need to iterate through all package files after the initial parsing.

As another example, in order for Gradle to extract dependencies Renovate must first call a command via a child process.

The `extractAllPackageFiles` function takes an array of filenames as input.
It returns an array of filenames and dependencies.

If you implement `extractAllPackageFiles` the manager must export as well either `updateDependency` or `extractPackageFile`.

### `getRangeStrategy(config)` (optional)

Write this optional function if you want the manager to support "auto" range strategies.
For example, pinning or _not_ pinning a dependency, depending on other values in the package file.

The `npm` manager uses the `getRangeStrategy` function to pin `devDependencies` but not `dependencies`, unless the package file is detected as an app.

If left undefined, then a default `getRangeStrategy` will be used that always returns "replace".

### `supportsLockFileMaintenance` (optional)

Set to `true` if this package manager needs to update lock files in addition to package files.

### `updateArtifacts` (async, optional)

Use `updateArtifacts` to run binaries that in turn will update files.
We often use `updateArtifacts` to update lock files indirectly.

To _directly_ update dependencies in lock files: use `updateLockedDependency` instead.

`updateArtifacts` gets triggered:

- after a dependency update (for a package file), or
- during `lockfileMaintenance`

### `updateDependency` (optional)

Use `updateDependency` if _both_ conditions apply:

- the manager can't be updated to use the standard replacing mechanism
- a custom replacement has to be provided

### `updateLockedDependency` (optional)

Use `updateLockedDependency` to directly update dependencies in lock files.

## Package files and Lock files

In Renovate terminology, "package files" are the files where human-readable dependency definitions are kept.
For example, this includes npm's `package.json` file, Maven's `pom.xml` file, and Docker's `Dockerfile`.

Some package managers may additionally have "lock files", e.g. npm's `package-lock.json`.
If a lock file is present in a repository then Renovate needs to update both in the same commit, otherwise the update may be "broken".
Therefore if a new manager is being developed and it is usual to have a lock file, supporting lock file updating should be done from the start.

Supporting lock file updating usually requires Renovate to support a third party tool, e.g. `npm`, `poetry`, etc.
It's rare and not recommended for Renovate to "reverse engineer" lock file formats and make updates manually instead of calling such tools.
Adding support for such tools requires adding awareness of each tool to [Containerbase](https://github.com/containerbase/base) first.

Here are the various ways in approximate order in which lock file awareness should be added to a manager:

### Lock file maintenance

The purpose of lock file maintenance is to update all locked dependencies (including transitive) to the latest possible versions.

There are two approaches which can be used:

- Delete the existing lock file, then call a command like `<tool> install` to regenerate it, or
- Call a command like `<tool> update` if such a command exists to satisfy this same requirement (updating the entire lock file where possible)

Where available, the second approach is better because lock file may sometimes have platform-specific information (e.g. amd64, arm64) which can be lost if the lock file is regenerated completely as in the first approach.

### Lock file updating after a package file change

This functionality is often mandatory from initial implementation.

In this scenario, an `updateArtifacts()` function must be added.
Its purpose is to essentially "sync" the lock file to the package file changes made by Renovate, so that both files can be updated in the same commit.

Usually, the flow is like this:

1. Renovate makes changes to the version or constraint in the package file directly,
2. Renovate calls a tool command like "<tool> install", "<tool> lock", etc.
3. If the tool command resulted in a changed lock file (it usually should), then Renovate commits the changes along with the package file change

### Locked version extracting and dependency pinning

The next step is for the manager's "extract" functionality to return a `lockedVersion` for dependencies whenever a lock file exists.
To do this, the manager should:

1. Parse the lock file
2. Associate each dependency from the package file with its entry in the lock file
3. Add that associated version as `lockedVersion`

Once `lockedVersion` is provided, Renovate should be able to "pin" constraints/ranges into exact versions, if the user configures as such (e.g. `rangeStrategy=pin`) however Renovate _won't_ automatically be able to make lockfile-only updates.

### Lock file-only updates

#### updateArtifacts()

It's a common scenario where users want or need to retain constraints in their package file (e.g. `^1.0.0`) and have Renovate make updates to the lock file when new versions are available (e.g. updating from a locked value of `1.1.0` to `1.1.1`).
In this case, it's a prerequisite that the manager must extract `lockedVersion` as described above.

In addition to this, the manager needs to add logic to `updateArtifacts()` to detect if any of the updates it has been passed satisfy `isLockFileUpdate=true`.
If any lock file-only updates have been passed, then the manager typically needs to run specific commands to update/bump the locked version for one specific dependency only.
This functionality is manager-specific, and depends heavily on the capabilities of the third party tool, but a mix of the following approaches are used in Renovate, from best to worst:

- Renovate calls a tool command to specifically update the dependency in question to the specific version, e.g. `<tool> update <dependency name>@<new version>`
- Renovate manually updates the locked version in the lock file it needs updated, then calls a `<tool> install` command to "fix" up the remaining parts (hashes, transitive dependencies, etc). This is good if it works but it is prone to breaking in future releases because it's possible that the maintainers of the tool are not aware of people using it in this manner, even if it works unintentionally.
- Renovate calls a tool command similar to the first approach, except the tool doesn't support specific versions, e.g. `<tool> update <dependency name>`. This approach can be problematic because Renovate might _want_ to update to e.g. v1.1.1 but instead the tool finds a newer v1.1.2 and that's what the user gets instead

A further complication is that sometimes dependencies need to be upgraded together or else there are peer dependency problems or other conflicts.
In that case it's best if the tool can support a list of dependencies to update and they are done all at once.

#### updateLockedDependency()

The `updateLockedDependency()` method is optional for managers but recommended that any manager which supports `rangeStrategy=update-lockfile` implements the `updateLockedDependency()` method.
The most valuable part of this method is returning quickly if a dependency is already updated, so that tool commands don't need to be run every time.

The simplest logic for this method is:

1. Parse the existing lock file
2. If the locked version of the dependency is already updated to the version specified then return `{ status: 'already-updated' }`
3. Otherwise, return `{ status: 'unsupported' }`

An example of this can be seen in [the composer manager source code for updateLockedDependency()](https://github.com/renovatebot/renovate/blob/da4964ac05952f9fe0543ba1174fcd62ad083d48/lib/modules/manager/composer/update-locked.ts#L7-L30).=
