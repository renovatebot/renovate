The `gradle` manager uses a custom parser written in JavaScript, similar to many others managers.
It does not call `gradle` directly in order to extract a list of dependencies.

### Updating lockfiles

Updating lockfiles is done with `./gradlew :dependencies --wirte/update-locks` command.
This command can output excessive text to the console.
While running the command, the output to stdout is dropped when you run Renovate on most platforms other than Windows.
