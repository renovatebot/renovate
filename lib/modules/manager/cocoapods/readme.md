The `cocoapods` manager supports extracting both "pod" type references as well as dependencies on GitHub repositories that use versioned tags.

Whenever a `Podfile` is updated, Renovate will also update any accompanying `Podfile.lock` file. This is done using the `cocoapods` gem which runs within the Ruby runtime.
