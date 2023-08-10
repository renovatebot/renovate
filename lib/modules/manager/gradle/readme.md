The `gradle` manager uses a custom parser written in JavaScript, similar to many others managers.
It does not call `gradle` directly in order to extract a list of dependencies.

### Updating lockfiles

The gradle manager supports gradle lock files in `.lockfile` artifacts, as well as lock files used by the [gradle-consistent-versions](https://github.com/palantir/gradle-consistent-versions) plugin.
During [lock file maintenance](https://docs.renovatebot.com/configuration-options/#lockfilemaintenance), renovate calls `./gradlew :dependencies --write-locks` on the root project and subprojects.
For regular dependency updates, renovate automatically updates lock state entries via the `--update-locks` command line flag.

As the output of these commands can be very large, any text other than errors (in `stderr`) is discarded.
