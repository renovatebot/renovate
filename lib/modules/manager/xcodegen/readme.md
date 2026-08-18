Extracts Swift package dependencies from [XcodeGen](https://github.com/yonaskolb/XcodeGen) `project.yml` files.

The default `project.yml` file name is used for file matching, but users can extend the `managerFilePatterns` config option to match custom file names.

Supported version specifiers:

- `from` / `majorVersion` (major version constraint)
- `minorVersion` (minor version constraint)
- `exactVersion` / `version` (fixed version)

The following version specifiers are detected but not supported for updates:

- `branch` (branch reference)
- `revision` (Git SHA)
- `minVersion` / `maxVersion` (range constraints)

Local packages (specified with `path`) are ignored.

Both `url` and `github` shorthand are supported for specifying the package source.
