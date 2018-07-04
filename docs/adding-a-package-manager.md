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

- contentPattern (optional)
- extractDependencies
- getRangeStrategy (optional)
- language (optional)
- postExtract (optional)
- supportsLockFileMaintenance (optional)
- updateDependency

##### contentPattern (optional)

`contentPattern` is only necessary if there's the possibility that some of the files matched by `fileMatch` may not belong to that package manager, or maybe don't have any dependencies.

An example `contentPattern` is from Meteor.js: `(^|\\n)\\s*Npm.depends\\(\\s*{`. Because Meteor's `package.js` is not particularly "unique", it's quite possible that repositories will have one or more `package.js` files that have nothing to do with Meteor.js, so we filter out only the ones that include `Npm.depends` in it.

Note: it's possible that the `extractDependencies` function can perform this filtering instead.

##### `extractDependencies(content, packageFile, config)` (async, mandatory)

This function is mandatory. It takes a file content and optionally the packageFile name/config, and returns an array of detected/extracted dependencies, including:

- dependency name
- dependency type (e.g. dependencies, devDependencies, etc)
- currentValue
- version scheme used (e.g. semver, pep440)

The fields returned here can be customised to suit the package manager, e.g. Docker uses `currentFrom`

This function doesn't necessarily need to _understand_ the file or even syntax that it is passed, instead it just needs to understand enough to extract the list of dependencies.

As a general approach, we want to extract _all_ dependencies from each dependency file, even if they contain values we don't support. For any that have unsupported values that we cannot renovate, this `extractDependencies` function should set a `skipReason` to a value that would be helpful to someone reading the logs.

Also, if a file is passed to `extractDependencies` that is a "false match" (e.g. not an actual package file, or contains no dependencies) then this function can return `null` to have it ignored and removed from the list of package files. A common case for this is in Meteor, where its `package.js` file name is not unique and there many be many non-Meteor paojects using that filename.

#### `getRangeStrategy(config)` (optional)

This optional function should be written if you wish the manager to support "auto" range strategies, e.g. pinning or not pinning depending on other values in the package file. `npm` uses this to pin `devDependencies` but not `dependencies` unless the package file is detected as an app.

If left undefined, then a default `getRangeStrategy` will be used that always returns "replace".

##### `language` (optional)

This is used when more than one package manager share settings from a common language. e.g. docker-compose, circleci and gitlabci all specify "docker" as their language and inherit all config settings from there.

#### `postExtract(packageFiles)` (async, optional)

This function takes an array of package files (extracted earlier using `extractDependencies`) and is useful if some form of "correlation" is required between the files.

For example, Yarn Workspaces and Lerna are tools for working with multiple package files at once, including generating a single lock file instead of one per package file. It is therefore necessary to have a "full view" of all package files to determine if such logic is necessary, because the `extractDependencies` function only sees each package file in isolation.

Currently `npm` is the only package manager using this function, because all other ones are able to extract enough data from package files in isolation.

#### `supportsLockFileMaintenance` (optional)

Set to true if this package manager needs to update lock files in addition to package files.

##### `updateDependency(fileContent, upgrade)`

This function is the final one called for most managers. It's purpose is to patch the package file with the new value (described in the upgrade) and return an updated file. If the file was already updated then it would return the same contents as it was provided.
