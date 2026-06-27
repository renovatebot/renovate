# Local

With the "local" platform you can perform dry runs of Renovate against the local file system.
This can be handy when testing a new Renovate configuration for example.

## Usage

Run the `renovate --platform=local` command in the directory you want Renovate to run in.
In this mode, Renovate defaults to `dryRun=lookup`.

You can override `dryRun` with one of:

- `--dry-run=extract`: stop after the extract phase, to see which dependencies Renovate detects.
- `--dry-run=full`: additionally compute the file changes Renovate would make and write them to the working directory, so you can inspect (for example with `git diff`) exactly what Renovate would change. Renovate never commits, pushes, or opens a pull request in this mode.

Any other `dryRun` value (such as `null`, which would imply committing changes) falls back to `lookup`.

### `dry-run=full` and your working directory

Because the local platform operates on your _current working directory_, `--dry-run=full` modifies the files in place.
To keep this safe, Renovate refuses to run `--dry-run=full` when the git work tree has uncommitted changes, so that you can always undo Renovate's changes with `git checkout .`.
Commit or stash your changes first, run Renovate, inspect the result, then revert with `git checkout .` once you're done.
If you run `--dry-run=full` in a directory that is not a git repository, Renovate warns you that its changes cannot be reverted automatically.

Avoid giving "repositories" arguments, as this command can only run in a _single_ directory, and it can only run in the _current working_ directory.

You may run the command above on "plain" directories, or "Git directories".
You don't need to provide any config, as the command will run with or without "repo config".

The command doesn't do any "compare" - or before and after analysis - if you want to test a new config then you must manually compare.

## Limitations

- `local>` presets can't be resolved. Normally these would point to the local platform such as GitHub, but in the case of running locally, it does not exist
- `baseBranchPatterns` are ignored
- Branch creation is not supported
