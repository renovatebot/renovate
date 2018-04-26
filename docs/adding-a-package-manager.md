# Adding a Package Manager

This document describes the steps to take if you are interest in adding new language/package manager support.

### Background

Renovate began life as a JavaScript-only, specifically for the npmjs ecosystem. 
Over time, additional "package managers" (e.g. Meteor.js, Dockerfile, nvm) have been added and the codebase incrementally refactored and improved with many of those to make it easier to add newer ones in future.

### Code structure

Each package manager lives under `lib/managers/*`, and are often tightly coupled to datasources under `lib/datasource/*`.
Common logic for Renovate - not specific to particular managers - generally lives under `lib/workers/*`.

### Manager requirements

Each manager needs its own subdirectory under `lib/managers` and to be added to the list of managers in `lib/managers/index.js`.

The manager's `index.js` file then needs to export up to 7 functions or values:

```js
module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  parentManager,
  resolvePackageFile,
  updateDependency,
};
```

##### parentManager (optional)

This is used when more than one package manager share common characteristics. e.g. docker-compose, circleci and gitlabci all specify "docker" as their parent manager and inherit all config settings from there.

##### filePattern

`filePattern` is a javascript `RegExp` used to detect the manager's files within the repository. 

An example `filePattern` from Docker Compose is `(^|/)docker-compose[^/]*\\.ya?ml$`. You can see that it's designed to match files both in the root as well as in subdirectories, and to be flexible with matching yaml files that start with `docker-compose` but may have additional characters in the filename.

##### contentPattern (optional)

`contentPattern` is only necessary if there's the possibility that some of the files matched by `filePattern` may not belong to that package manager, or maybe don't have any dependencies.

An example `contentPattern` is from Meteor.js: `(^|\\n)\\s*Npm.depends\\(\\s*{`. Because Meteor's `package.js` is not particularly "unique", it's quite possible that repositories will have one or more `package.js` files that have nothing to do with Meteor.js, so we filter out only the ones that include `Npm.depends` in it.

##### resolvePackageFile (optional)

`resolvePackageFile` is a function only necessary if you need to do anything "special" with the file after downloading it and before parsing it.
For example, it is used in the npm package manager to detect additional files like `.npmrc`, `package-lock.json` and `yarn.lock`.
For most managers, it is not necessary.

##### extractDependencies

This function is essential. It takes a file content and returns an array of detected/extracted dependencies, including:

- dependency name
- dependency type (e.g. dependencies, devDependencies, etc)
- currentVersion

The fields returned here can be customised to suit the package manager, e.g. Docker uses `currentFrom`

Until now, `extractDependencies` has been done 100% in Renovate's JS, however it's possible that some future package manager's configuration file may be so complex that we may need to spawn to a CLI command to help parse and extract dependencies.

##### getPackageUpdates

This function is called per-dependency to return a list of possible updates for that dependency. If it is up to date, then an empty array is returned.
Again, this has been done completely in JS so far, however to continue doing it entirely in JS means that we may have to build accurate implementations of other language's versioning and range specification, which could be hard.
Additionally, some package managers may use complex algorithms to determine the best updated set of dependencies - more complex than simply "is there a newer version of x?"
Therefore, there is the possibility that for some future package managers we may need to use a child process to spawn the package manager itself rather than reinvent it within JS.

##### updateDependency

This function is the final one called for a manager. It's purpose is to patch the package file with the new version and return an updated file.
