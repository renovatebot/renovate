---
title: Java Versions
description: Java versions support in Renovate
---

# Java Dependency Updates

Renovate can update Gradle and Maven dependencies.
This includes libraries and plugins.

## Gradle

Renovate detects versions that are specified in a string `'group:artifact:version'` and those specified in a map `(group:groupName, name:ArtifactName, version:Version)`.

### File Support

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

### File Support

Renovate will search repositories for all `pom.xml` files and processes them independently.

### Custom registry support, and authentication

Here is an example configuration to work with custom Artifactory servers using authentication:

```json
{
  "hostRules": [
    {
      "hostType": "maven",
      "baseUrl": "https://artifactoryurl1/",
      "username": "artifactoryusername",
      "password": "artifactorypassword"
    },
    {
      "hostType": "maven",
      "baseUrl": "https://artifactoryurl2/",
      "username": "artifactoryusername",
      "password": "artifactorypassword"
    }
  ],
  "packageRules": [
    {
      "managers": ["maven"],
      "registryUrls": ["https://artifactoryurl1/", "https://artifactoryurl2/"]
    }
  ]
}
```

In the above config, the custom registry URLs are defined using a package rule, and the username/passwords are set using a host rule each. If you don't want to store your artifactory credentials in plaintext, you can pass them as an environment variable using a javascript config file like `renovate-config.js`:

```js
module.exports = {
  hostRules: [
    {
      hostType: 'maven',
      baseUrl: 'https://artifactory.yourcompany.com/',
      username: process.env.ARTIFACTORY_USR,
      password: process.env.ARTIFACTORY_PSW
    }
  ]
};
