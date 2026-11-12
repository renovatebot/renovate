This manager updates the Kotlin Toolchain CLI version that is pinned in the `kotlin` and `kotlin.bat` wrapper scripts of a [Kotlin Toolchain](https://kotlin-toolchain.org) project.

The version is read from the `kotlin_cli_version=` line of the wrapper script and looked up on Maven as `org.jetbrains.kotlin:kotlin-cli`.
The repository that the wrapper downloads from is taken from `KOTLIN_CLI_DOWNLOAD_ROOT`, so a project that uses a private mirror is looked up on that mirror.
A wrapper that does not set `KOTLIN_CLI_DOWNLOAD_ROOT` is looked up on the public JetBrains repository, `https://packages.jetbrains.team/maven/p/amper/amper`.

The `kotlin` and `kotlin.bat` scripts in the same directory describe one and the same version, so Renovate reports a single dependency for the pair and updates both scripts together.
If the two scripts disagree on the version, the checksum or the download root, Renovate skips the directory instead of rewriting one script from the metadata of the other.
This consistency check includes both existing scripts even when `ignorePaths` or `managerFilePatterns` excludes one of them from extraction, because artifact updates replace both scripts.

Both scripts also pin a checksum of the CLI distribution, which Renovate cannot compute on its own.
Renovate therefore downloads the official wrapper scripts of the new version from `<download root>/org/jetbrains/kotlin/kotlin-cli/<version>/` and replaces the local ones in full, instead of editing the version line in place.
That download uses the `maven` host type, so a `hostRules` entry with `hostType` `maven` authenticates it.
A mirror that carries the CLI distribution but not the `-wrapper` artifacts produces an artifact error instead of a silent skip.
Each download is also checked against the form of the script it replaces, so a mirror that serves the shell wrapper for `kotlin.bat`, or the batch wrapper for `kotlin`, produces an artifact error instead of a script that cannot run on that platform.
When any script of the pair cannot be downloaded, Renovate leaves both scripts at their current version and retries on the next run, so a branch never pins a new version against the checksum of the old one.
The same happens when the downloaded scripts disagree with each other, because a pair written from an inconsistent mirror would be skipped on the next extraction.
The failure shows up in the log, and as an artifact error comment when the branch carries other updates.

Renovate keeps the `KOTLIN_CLI_DOWNLOAD_ROOT` that the local script declares, and writes it into the downloaded script.
A downloaded script that has no recognizable download-root line is rejected as an artifact error instead of being committed, because a stock wrapper always declares one.
Any other local edit to a wrapper script is lost on update.

### Recognizing a wrapper script

A file named `kotlin` or `kotlin.bat` is only treated as a wrapper when it contains a `kotlin_cli_version=` line, so an unrelated script with the same name is left alone.
The download root is only recognized in the two forms that the stock wrappers use, `KOTLIN_CLI_DOWNLOAD_ROOT="${KOTLIN_CLI_DOWNLOAD_ROOT:-<url>}"` in `kotlin` and `if not defined KOTLIN_CLI_DOWNLOAD_ROOT set KOTLIN_CLI_DOWNLOAD_ROOT=<url>` in `kotlin.bat`.
A script that sets it in another way is looked up on the default repository, and its download-root line is replaced by the stock one on update.

### Disabling wrapper updates

To keep the Kotlin Toolchain wrapper at its current version:

```json
{
  "kotlin-toolchain-wrapper": {
    "enabled": false
  }
}
```
