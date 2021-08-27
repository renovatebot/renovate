---
title: Java Versions
description: Java versions support in Renovate
---

# Java Dependency Updates

Renovate can update Gradle and Maven dependencies.
This includes libraries and plugins as well as the Gradle Wrapper.

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

## Gradle Wrapper

Renovate can update the [Gradle Wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html) of a project.

This includes the source declaration inside the `gradle/wrapper/gradle-wrapper.properties`
as well as accompanied files such as `gradlew`, `gradlew.bat`, and `gradle/wrapper/gradle-wrapper.jar`.

### How It Works

Renovate extracts the Gradle Wrapper version used from the `distributionUrl` inside the `gradle-wrapper.properties`.
Once the version is determined, Renovate will look for newer versions from the `gradle-version` datasource.
Renovate will then invoke the Gradle Wrapper to update itself,
[as recommended by Gradle](https://docs.gradle.org/current/userguide/gradle_wrapper.html#sec:upgrading_wrapper).

For the extraction to work, the `distributionUrl` must point to
a file of type .zip,
which includes the version in its name, and
defines one of the official distribution types (bin, all).

### Support for mirrors and custom distributions

As Renovate takes the `distributionUrl` defined inside the `gradle-wrapper.properties` as basis for its update,
source declarations other than to the official Gradle Wrapper are supported.

This can be used for hosting the official distributions with a proxy server, an offline mirror
or even providing a custom distribution of the Gradle Wrapper,
e.g. to provide a company-wide base configuration for all Gradle projects.

However, the `gradle-version` datasource is used to determine available versions.
In case the available versions at the defined source differ
from those available from Gradle
or the [default datasource](https://services.gradle.org/versions/all) cannot be reached, e.g. due to network restrictions,
the datasource may be reconfigured via a `packageRule`.

```json
{
  "packageRules": [
    {
      "matchDatasources": ["gradle-version"],
      "registryUrls": [
        "https://domain.tld/repository/custom-gradle-wrapper/versions.json"
      ]
    }
  ]
}
```

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
      matchHost: 'https://artifactory.yourcompany.com/',
      username: process.env.ARTIFACTORY_USERNAME,
      password: process.env.ARTIFACTORY_PASSWORD,
    },
  ],
};
```
