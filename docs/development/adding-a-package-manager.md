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
- a list of lock files ( `lockFiles` ) that are associated with this package file, if applicable

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

A special Renovate term is "package files".
Package files have human-readable dependency definitions, for example:

- npm's `package.json` file
- Maven's `pom.xml` file
- Docker's `Dockerfile`

Some package managers may also have "lock files", like npm's `package-lock.json`.

If a repository has a lock file, then Renovate _must_ update the package file _and_ the matching lock file in the same commit.
This prevents creating "broken" updates for users and generating frustration with Renovate.

### Focus on getting lock file syncing working

When you develop a new package manager, which supports lockfiles, focus on getting lock file synchronization working.

Supporting lock file synchronization usually means that Renovate runs a third-party tool, like `npm` or `poetry`.
The third-party tool then updates the lock file for Renovate.

### Avoid reverse engineering lock file formats

Let a third-party package manager (`npm`, `poetry`, etc.) update the lockfile.
Avoid "reverse engineering" lock file formats, where Renovate manually updates the lock file.

Only "reverse engineer" lock file formats as a last resort.

### Add third-party tools to Containerbase first

Add third-party package manager tools to [Containerbase](https://github.com/containerbase/base) first.

Here are the various ways in approximate order in which lock file awareness should be added to a manager:

### Lock file maintenance

The goal of lock file maintenance is to update all locked dependencies (including transitive dependencies) to the latest possible version, without changing ranges defined in package files.

There are two ways to update lock files:

- Call a command like `<tool> update` to update all locked dependencies (plus transitive dependencies), updating the whole lock file where possible
- Delete the lock file, then call a command like `<tool> install` to create a new lockfile

If you can, use the `<tool> update` method, as that keeps platform-specific information.

#### Keep platform-specific information

Lock files may have platform-specific information (e.g. `amd64`, `arm64`).
If you delete the lock file, and then create a new lock file with `<tool> install`, the platform-specific information is lost.

If you can, use the `<tool> update` method instead!

### Lock file updating after a package file change

Updating lock files after a package file changes is a fundamental feature.
This means you often need to build it first, when adding new package manager to Renovate.

Add a `updateArtifacts()` function, that "syncs" the lock file to the package file changes made by Renovate.
This way, both files can be updated in the same commit.

Usually, the flow is like this:

1. Renovate directly changes the version or constraint in the package file,
2. Renovate calls a tool command like `<tool> install`, `<tool> lock`, etc.
3. If the tool command changes the lock file (which it usually should!), then Renovate commits the changed lock file and the package file

### Locked version extracting and dependency pinning

The next step is for the manager's "extract" feature to return a `lockedVersion` for dependencies, whenever a lock file exists.
To do this, the manager needs to:

1. Parse the lock file
2. Match each dependency from the package file to its entry in the lock file
3. Add the matched version as `lockedVersion`

Once `lockedVersion` is provided, Renovate should be able to "pin" constraints/ranges into exact versions, if the user configures as such (e.g. `rangeStrategy=pin`), however Renovate _won't_ automatically be able to make lockfile-only updates.

### Lock file-only updates

#### updateArtifacts()

End users often want, or need to:

- preserve constraints in their package file (like `^1.0.0`)
- and want Renovate to update their lock file when a new versions is available (e.g. updating from a locked value of `1.1.0` to `1.1.1`)

In this case, the Renovate package manager must extract the `lockedVersion` as described above!

#### Detect if updates satisfy `isLockFileUpdate=true`

In addition to this, the manager needs to add logic to `updateArtifacts()` to detect if _any_ of the updates it has been passed satisfy `isLockFileUpdate=true`.

If any lock file-only updates have been passed, then the manager typically needs to run specific commands to update/bump the locked version for one specific dependency only.
This functionality is manager-specific, and depends heavily on the capabilities of the third-party tool.
A mix of the following approaches are used in Renovate, from best to worst:

- Renovate calls a tool command to specifically update the dependency in question to the specific version, e.g. `<tool> update <dependency name>@<new version>`
- Renovate manually updates the locked version in the lock file it needs updated, then calls a `<tool> install` command to "fix" up the remaining parts (hashes, transitive dependencies, etc). This is good, if it works, but it is prone to breaking in future releases if the maintainers of the tool do not know people are using their package manager in this manner, even if it works unintentionally.
- Renovate calls a tool command similar to the first approach, except the tool does not support specific versions, e.g. `<tool> update <dependency name>`. This approach can be problematic because Renovate might _want_ to update to e.g. `v1.1.1` but instead the tool finds a newer `v1.1.2` and that's what the user gets instead

##### Difficult cases

A further complication is that sometimes:

- dependencies must be upgraded together
- there are peer dependency problems
- or there is some other conflict

In those cases it's best if the tool supports creating a list of dependencies to update, and the tool then updates all dependencies at once.

#### updateLockedDependency()

The `updateLockedDependency()` method is optional for managers.
But we recommend that any manager which supports `rangeStrategy=update-lockfile` also implements the `updateLockedDependency()` method.

The goal of the `updateLockedDependency()` method is to return quickly if a dependency is already updated.
This way, Renovate only runs tool commands when there is a dependency to update.

The simplest logic for `updateLockedDependency()` is:

1. Parse the existing lock file
2. If the locked version of the dependency is already updated to the version specified: return `{ status: 'already-updated' }`
3. Else: return `{ status: 'unsupported' }`

An example of this can be seen in [the `composer` manager source code for `updateLockedDependency()`](https://github.com/renovatebot/renovate/blob/da4964ac05952f9fe0543ba1174fcd62ad083d48/lib/modules/manager/composer/update-locked.ts#L7-L30).
