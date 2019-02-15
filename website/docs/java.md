---
title: Java Versions
description: Java versions support in Renovate
---

# Java Versions

Renovate can update the version used in Gradle projects. This includes libraries and plugins.

It detects versions specified as string `'group:artifact:version'` and as a map `(group:groupName, name:ArtifactName, version:Version)`

## File Support

Renovate can update `build.gradle` files in the root of the repository and any `*.gradle` file inside any subdirectory as multi-project configurations.

Renovate does not support:

- Projects without a `build.gradle` file in the root of the repository.
- Android projects that requires extra configuration to run. (e.g. setting the android SDK)

## How It Works

Renovate uses [gradle-versions-plugin](https://github.com/ben-manes/gradle-versions-plugin) to generate a report with the dependencies that needs
to be updated. Then it goes through every gradle configuration file looking for every dependency and if it is found it
replaces the version.

It automatically configures [gradle-versions-plugin](https://github.com/ben-manes/gradle-versions-plugin) so you don't need to have it configured
as a dependency.

## Future Work

Gradle support is currently being rewritten to be compatible with Renovate's other package managers, and no longer require the use of `gradle-versions-plugin`. With this will come Android support as well.

Maven support is also in development and anticipated to be ready soon.
