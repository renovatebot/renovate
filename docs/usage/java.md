---
title: Java Versions
description: Java versions support in Renovate
---

# Java Dependency Updates

Renovate can update Gradle and Maven dependencies.
This includes libraries and plugins.

## Gradle

Renovate detects versions that are specified in a string `'group:artifact:version'` and those specified in a map `(group:groupName, name:ArtifactName, version:Version)`.

### Gradle File Support

Renovate can update `build.gradle`/`build.gradle.kts` files in the root of the repository.
It also updates any `*.gradle`/`*.gradle.kts` files in a subdirectory as multi-project configurations.

Renovate does not support:

- Projects which do not have either a `build.gradle` or `build.gradle.kts` in the repository root
- Android projects that require extra configuration to run (e.g. setting the Android SDK)
- Gradle versions prior to version 5.0.

### How It Works

Renovate uses a plugin to search and extract versions from projects.
Once the Gradle plugin has detected the dependencies, lookups and updating will be performed like usual with datasources and direct patching of files.

## Maven

Renovate can update dependency versions found in Maven `pom.xml` files.

### Maven File Support

Renovate will search repositories for all `pom.xml` files and processes them independently.

### Custom registry support, and authentication

This example shows how you can use a `config.js` file to configure Renovate for use with Artifactory.
We're using environment variables to pass the Artifactory username and password to Renovate bot.

```js
module.exports = {
  hostRules: [
    {
      hostType: 'maven',
      baseUrl: 'https://artifactory.yourcompany.com/',
      username: process.env.ARTIFACTORY_USERNAME,
      password: process.env.ARTIFACTORY_PASSWORD,
    },
  ],
};
```
