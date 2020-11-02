---
title: Java Versions
description: Java versions support in Renovate
---

# Java Dependency Updates

Renovate can update the version used in Gradle and Maven projects.
This includes libraries and plugins.

## Gradle

Renovate detects versions specified as string `'group:artifact:version'` and as a map `(group:groupName, name:ArtifactName, version:Version)`.

### File Support

Renovate can update `build.gradle`/`build.gradle.kts` files in the root of the repository and any `*.gradle`/`*.gradle.kts` file inside any subdirectory as multi-project configurations.

Renovate does not support:

- Projects with neither `build.gradle` nor `build.gradle.kts` in the root of the repository.
- Android projects that require extra configuration to run (e.g. setting the Android SDK).
- Gradle versions prior to version 5.0.

### How It Works

Renovate uses a plugin to search and extract versions from projects.
They are then looked up using Maven datasources and patched into PRs the usual way.

## Maven

Renovate can update dependency versions found in Maven `pom.xml` files.

### File Support

Renovate will search repositories for all files named `pom.xml` and then process them independently.

### Custom registry support, and authentication

Here is an example configuration to work with custom Artifactory servers using authentication:

```
{
	"maven": {
	    "enabled": true
	},
	"hostRules": [{
	    "hostType": "maven",
        "endpoint": "https://artifactoryurl1/",
	    "username": "artifactoryusername",
	    "password": "artifactorypassword"
	}, {
	    "hostType": "maven",
        "endpoint": "https://artifactoryurl2/",
	    "username": "artifactoryusername",
	    "password": "artifactorypassword"
	}],
    "packageRules": [{
        "managers": ["maven"],
	    "registryUrls": ["https://artifactoryurl1/", "https://artifactoryurl2/"]
    }]
}
```

In the above config, the custom registry URLs are defined using a package rule, and the username/passwords are set using a host rule each.
