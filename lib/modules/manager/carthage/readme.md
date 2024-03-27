The `carthage` manager supports extracting both binary distributions as well as dependencies on GitHub repositories that use versioned tags.
Unversioned dependencies and dependencies targeting a branch are not supported.

Whenever a `Cartfile` is updated, Renovate will also update any associated `Cartfile.resolved` file.
This is done manually without running `carthage` by just replacing the raw version which should be valid in most of the cases.
