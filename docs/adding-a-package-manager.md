# Adding a Package Manager

This document describes the steps to take if you are interest in adding new language/package manager support.

### Background

Renovate began life as a JavaScript-only, specifically for the npmjs ecosystem.
Over time, additional "package managers" (e.g. Meteor.js, Dockerfile, nvm) have been added and the codebase incrementally refactored and improved with many of those to make it easier to add newer ones in future.

### Code structure

Each package manager lives under `lib/manager/*`, and are often tightly coupled to datasources under `lib/datasource/*`.

Versioning logic (e.g. semver, pep440) lives under `lib/versioning/*`.

Common logic for Renovate - not specific to particular managers - generally lives under `lib/workers/*`.

### Manager requirements

Each manager needs its own subdirectory under `lib/managers` and to be added to the list of managers in `lib/managers/index.js`.

The manager's `index.js` file supports the following values/functions:

- extractPackageFile
- extractAllPackageFiles
- getRangeStrategy (optional)
- language (optional)
- supportsLockFileMaintenance (optional)
- updateDependency

##### `extractPackageFile(content, packageFile, config)` (async, semi-mandatory)

This function is mandatory unless you use `extractAllPackageFiles` instead. It takes as arguments the file's content and optionally the file's full file pathname and config, and returns an array of detected/extracted dependencies, including:

- dependency name
- dependency type (e.g. dependencies, devDependencies, etc)
- currentValue
- version scheme used (e.g. semver, pep440)

The fields returned here can be customised to suit the package manager, e.g. Docker uses `currentFrom`

This function doesn't necessarily need to _understand_ the file or even syntax that it is passed, instead it just needs to understand enough to extract the list of dependencies.

As a general approach, we want to extract _all_ dependencies from each dependency file, even if they contain values we don't support. For any that have unsupported values that we cannot renovate, this `extractPackageFile` function should set a `skipReason` to a value that would be helpful to someone reading the logs.

Also, if a file is passed to `extractPackageFile` that is a "false match" (e.g. not an actual package file, or contains no dependencies) then this function can return `null` to have it ignored and removed from the list of package files. A common case for this is in Meteor, where its `package.js` file name is not unique and there many be many non-Meteor projects using that filename.

##### `extractAllPackageFiles(packageFiles)` (async, optional)

You can use this function instead of `extractPackageFile` if the package manager cannot parse/extract all package files in parallel.

For example, npm/yarn needs to correlate package files together for features such as Lerna and Workspaces, so it's necessary to iterate through them all together after initial parsing.

As another example, gradle needs to write out all files and call a command via child process in order to extract dependencies, so that must be done first.

This function takes an array of filenames as input and returns an array of filenames and dependencies as a result.

#### `getRangeStrategy(config)` (optional)

This optional function should be written if you wish the manager to support "auto" range strategies, e.g. pinning or not pinning depending on other values in the package file. `npm` uses this to pin `devDependencies` but not `dependencies` unless the package file is detected as an app.

If left undefined, then a default `getRangeStrategy` will be used that always returns "replace".

##### `language` (optional)

This is used when more than one package manager share settings from a common language. e.g. docker-compose, circleci and gitlabci all specify "docker" as their language and inherit all config settings from there.

#### `supportsLockFileMaintenance` (optional)

Set to true if this package manager needs to update lock files in addition to package files.

##### `updateDependency(fileContent, upgrade)`

This function is the final one called for most managers. It's purpose is to patch the package file with the new value (described in the upgrade) and return an updated file. If the file was already updated then it would return the same contents as it was provided.
