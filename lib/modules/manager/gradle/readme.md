The `gradle` manager uses a custom parser written in JavaScript, similar to many others managers.
It does not call `gradle` directly in order to extract a list of dependencies.

### Executing the Gradle Wrapper

Renovate will only execute the Gradle Wrapper (via `./gradlew` or `gradlew.bat`) if the self-hosted administrator configures [`allowedUnsafeExecutions`](../../../self-hosted-configuration.md#allowedunsafeexecutions) to include the `gradleWrapper` option.
This is required due to [possible supply chain security attack vectors](../../../security-and-permissions.md#trusting-repository-developers) that can occur with the Gradle Wrapper being executed.

### Updating lockfiles

The gradle manager supports gradle lock files in `.lockfile` artifacts, as well as lock files used by the [gradle-consistent-versions](https://github.com/palantir/gradle-consistent-versions) plugin.
During [lock file maintenance](../../../configuration-options.md#lockfilemaintenance), renovate calls `./gradlew :dependencies --write-locks` on the root project and subprojects.
For regular dependency updates, renovate automatically updates lock state entries via the `--update-locks` command line flag.

As the output of these commands can be very large, any text other than errors (in `stderr`) is discarded.

### Dependency verification

Renovate supports [Gradle's dependency verification functionality](https://docs.gradle.org/current/userguide/dependency_verification.html) to ensure that checksums are calculated for your dependencies.

!!! note
  This requires [your self-hosted administrator to allow the Gradle Wrapper to execute](#executing-the-gradle-wrapper).

If Renovate finds a `gradle/verification-metadata.xml` file and either `<verify-metadata>true</verify-metadata>` or `<verify-signatures>true</verify-signatures>` (or both), it updates the content by using the `./gradlew --write-verification-metadata <hashTypes> dependencies` command.
Renovate will check the file for existing hash types (like `sha256`) and use them as `<hashTypes>`.

!!! warning
  Gradle allows verification metadata to use the `md5` and `sha1` algorithms.
  Because those algorithms are prone to collision attacks, Renovate ignores them.
  If Renovate encounters hashes that are generated with `md5` or `sha1` algorithms, Renovate uses `sha256` instead.

### Rich version constraints

Renovate extracts dependencies whose version comes from a Gradle [rich version constraint](https://docs.gradle.org/current/userguide/dependency_versions.html#sec:rich-version-constraints) declared in a `version { ... }` block, in both the Groovy and the Kotlin DSL:

```groovy
dependencies {
    implementation('org.slf4j:slf4j-api') {
        version {
            strictly '[1.7, 1.8['
        }
    }
}
```

Renovate can only rewrite one version literal per dependency, so it picks a single constraint to update and records which one in `managerData.versionConstraint`:

| Declared constraints               | What Renovate updates                         |
| ---------------------------------- | --------------------------------------------- |
| `strictly`                         | `strictly`                                    |
| `strictly` + `prefer`              | `strictly`, if `strictly` is a single version |
| `require`                          | `require`                                     |
| `require` + `prefer`               | `require`, because `prefer` is only a hint    |
| `prefer`                           | `prefer`                                      |
| `require` + `strictly`             | nothing, skipped as `multiple-constraint-dep` |
| `strictly` range + `prefer`        | nothing, skipped as `multiple-constraint-dep` |
| anything + `reject` or `rejectAll` | nothing, skipped as `unsupported-version`     |

`strictly` and `prefer` pin a version on purpose, so Renovate disables those dependencies by default and only updates them for [vulnerability alerts](../../../configuration-options.md#vulnerabilityalerts).
A `require` constraint means the same thing as a plain version declaration, so it is updated like any other dependency.

To also receive regular updates for `strictly` and `prefer` constraints, opt in with a package rule:

```json
{
  "packageRules": [
    {
      "matchManagers": ["gradle"],
      "matchJsonata": [
        "managerData.versionConstraint in ['strictly', 'prefer']"
      ],
      "enabled": true
    }
  ]
}
```

!!! note
  Rich versions in [version catalogs](https://docs.gradle.org/current/userguide/platforms.html) are extracted by the TOML parser instead, which updates a single `require`, `prefer` or `strictly` constraint without disabling it.

!!! note
  A `version { ... }` block on a dependency that already spells out its version, such as `implementation('org.slf4j:slf4j-api:1.7.25') { version { strictly '1.7.30' } }`, is not valid Gradle.
  Renovate updates the version in the dependency string and ignores the block.
