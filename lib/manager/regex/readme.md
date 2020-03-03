The `regex` manager is designed to allow users to manually configure Renovate for how to find dependencies that aren't detected by the built-in package managers.

This manager is unique in Renovate in that:

- It is configurable via regex named capture groups
- Through the use of the `regexManagers` config, multiple "regex managers" can be created for the same repository.
