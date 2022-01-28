The `gradle` manager's default behavior uses a custom parser written in JavaScript, similar to many others managers.
It was initially known as `gradle-lite` but is now integrated into the `gradle` manager and used as default.

If `deepExtract` is configured to `true`, Renovate instead extracts Gradle dependencies by calling a custom Gradle script.
The `gradle` binary is then used to extract Maven-type dependencies.

<!-- prettier-ignore -->
!!! warning
    The `deepExtract` configuration option is deprecated, and will be removed in a future Renovate release.
