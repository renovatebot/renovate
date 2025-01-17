Regular Expression Versioning is designed to be a flexible fallback versioning approach if Renovate's other versioning schemes don't do the job.

The `regex` scheme makes use of Regular Expression capture groups.

The valid capture groups for `regex` versioning are:

- `major`, `minor`, and `patch`: at least one of these must be provided. When determining whether a package has updates, these values will be compared in the standard semantic versioning fashion. If any of these fields are omitted, they will be treated as if they were `0` -- in this way, you can describe versioning schemes with up to three incrementing values.
- `build`: this capture group can be used after you've already used the `major`, `minor` and `patch` capture groups and need a fourth version part. `build` updates are handled like `patch` updates.
- `revision`: this capture group can be used after you've already used the `build` capture groups and need a fifth version part. `revision` updates are handled like `patch` updates.
- `prerelease`: this value, if captured, will mark a given release as a prerelease (e.g. unstable). If this value is captured and you have configured `"ignoreUnstable": true`, the given release will be skipped.
- `compatibility`: this value defines the "build compatibility" of a given dependency. A proposed Renovate update will never change the specified compatibility value. For example, if you are pinning to `1.2.3-linux` (and `linux` is captured as the compatibility value), Renovate will not update you to `1.2.4-osx`.

The compatibility concept was originally introduced for Docker versioning but sometimes package authors may use/misuse suffixes to mean compatibility in other versioning schemes.

**Important: all capture groups must contain only purely numeric values.**
Even if there is a string prefix which is identical in all available versions, it must not be part of the capture group. For example a `build` capture group containing `r4` cannot be evaluated as number; Renovate cannot compare the `build` in this case. The capture group must be `4` instead.

Here is an example of using `regex` versioning to correct behavior of the `guava` Maven package, which misuses suffixes as compatibility indicators:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["com.google.guava:guava"],
      "versioning": "regex:^(?<major>\\d+)(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?(-(?<compatibility>.*))?$"
    }
  ]
}
```

Here is another example, this time for handling `python` Docker images, which use both pre-release indicators as well as version suffixes for compatibility:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["python"],
      "versioning": "regex:^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?<prerelease>[^.-]+)?(-(?<compatibility>.*))?$"
    }
  ]
}
```

Here is another example, this time for handling Bitnami Docker images, which use `build` and `revision` indicators as well as version suffixes for compatibility:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["bitnami/**", "docker.io/bitnami/**"],
      "versioning": "regex:^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?:-(?<compatibility>.+)(?<build>\\d+)-r(?<revision>\\d+))?$"
    }
  ]
}
```

Here is another example, this time for handling `ghcr.io/linuxserver/tautulli` Docker images, which use `major` and `build` indicators with string prefixes:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["ghcr.io/linuxserver/tautulli"],
      "versioning": "regex:^v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)-ls(?<build>.+)$"
    }
  ]
}
```

Here is another example, this time for handling `ghcr.io/linuxserver/openssh-server` Docker images, which use `patch`, `build` and `revision` indicators with string prefixes:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["ghcr.io/linuxserver/openssh-server"],
      "versioning": "regex:^(?<major>\\d+)\\.(?<minor>\\d+)_p(?<patch>\\d+)-r(?<build>\\d)-ls(?<revision>.+)$"
    }
  ]
}
```
