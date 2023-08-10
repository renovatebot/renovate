# Local

With the "local" platform you can perform dry runs of Renovate against the local file system.
This can be handy when testing a new Renovate configuration for example.

## Usage

Run the `renovate --platform=local` command in the directory you want Renovate to run in.
In this mode, Renovate defaults to `dryRun=lookup`.

Avoid giving "repositories" arguments, as this command can only run in a _single_ directory, and it can only run in the _current working_ directory.

You may run the command above on "plain" directories, or "Git directories".
You don't need to provide any config, as the command will run with or without "repo config".

The command doesn't do any "compare" - or before and after analysis - if you want to test a new config then you must manually compare.

## Limitations

- `local>` presets can't be resolved. Normally these would point to the local platform such as GitHub, but in the case of running locally, it does not exist
- `baseBranches` are ignored
- Branch creation is not supported
