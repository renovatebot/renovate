Artifactory is the recommended registry for Conan packages.

This datasource returns releases from given custom `registryUrl`(s).

The target URL is composed by the `registryUrl` and the `lookupName`, which defaults to `depName` when `lookupName` is not defined.
