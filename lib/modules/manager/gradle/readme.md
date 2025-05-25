The `gradle` manager uses a custom parser written in JavaScript, similar to many others managers.
It does not call `gradle` directly in order to extract a list of dependencies.

### Updating lockfiles

The gradle manager supports gradle lock files in `.lockfile` artifacts, as well as lock files used by the [gradle-consistent-versions](https://github.com/palantir/gradle-consistent-versions) plugin.
During [lock file maintenance](../../../configuration-options.md#lockfilemaintenance), renovate calls `./gradlew :dependencies --write-locks` on the root project and subprojects.
For regular dependency updates, renovate automatically updates lock state entries via the `--update-locks` command line flag.

As the output of these commands can be very large, any text other than errors (in `stderr`) is discarded.

### Dependency verification

If Renovate finds a `gradle/verification-metadata.xml` file and either `<verify-metadata>true</verify-metadata>` or `<verify-signatures>true</verify-signatures>` (or both), it updates the content by using the `gradle --write-verification-metadata <hashTypes> dependencies` command.
Renovate will check the file for existing hash types (like `sha256`) and use them as `<hashTypes>`.

<!-- prettier-ignore -->
!!! warning
    Gradle allows verification metadata to use the `md5` and `sha1` algorithms.
    Because those algorithms are prone to collision attacks, Renovate ignores them.
    If Renovate encounters hashes that are generated with `md5` or `sha1` algorithms, Renovate uses `sha256` instead.
