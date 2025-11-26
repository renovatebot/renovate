Devbox's Nixhub uses fairly strict versioning, characters such as ~, ^ and >= are not allowed.

The semver values must not include "\*" or "x". "1.2.3" "1.2" and "1" are the only valid formats.

Common pre-release and post-release formats are supported e.g. 1.2.3rc1 1.2.3-beta 1.2.3+4.

Due to the wide range of version formats allowed in nix packages this is a best effort,
contributions are welcome if the current versioning isn't working for a particular nix package you rely on.
