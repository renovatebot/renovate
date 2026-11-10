This datasource fetches both tags and branches from GitHub repositories, prioritizing tags over branches when names conflict.

It's designed for GitHub Actions that reference non-semver refs like branch names (`main`, `master`) or commit SHAs. It uses exact versioning, meaning no version ordering is performed - only digest pinning updates are supported.
