Renovate supports upgrading dependencies in [SDKMAN!](https://sdkman.io/) files.
For example:

```
# Enable auto-env through the sdkman_auto_env config
# Add key=value pairs of SDKs to use below
java=21.0.3-tem
gradle=8.10

```

Renovate only scans files with the `.sdkmanrc`.
What is currently being supported is `java`, `gradle`, `maven`, `sbt`.
