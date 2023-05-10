# Local

The "local" platform exists to allow users to perform dry runs against the local file system, such as to test out new config.

## Usage

Run `renovate --platform=local` in the directory you want Renovate to run in.
In this mode, Renovate will default to `dryRun=lookup`.
No "repositories" arguments should be provided, as you cannot run against multiple directories or run in the non-working directory.

It is possible to run on both a git and non-git directory.
Config is optional - so it will run either with or without any "repo config" found.

It does not do any "compare" or before and after analysis - if your purpose is to test a new config then you will need to manually compare.

## Limitations

- `local>` presets cannot be resolved. Normally these would point to the local platform such as GitHub, but in the case of running locally, it does not exist
- `baseBranches` are ignored
- Branch creation is not supported
