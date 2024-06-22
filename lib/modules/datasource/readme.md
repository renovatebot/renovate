# Datasources

Datasources are used in Renovate primarily to fetch released versions of packages.

## Follow the class-based programming style

New datasources _must_ follow the class-based programming style.
Use the `java-version` datasource as a reference.

Add the datasource to the API in [`api.ts`](api.ts) so that the new datasource is usable.
If you find `Pending mocks!` errors in the Jest tests _and_ your mocked URLs are correct, make sure the datasource is correctly registered.

## getReleases

The minimum exported interface for a datasource is a function called `getReleases` that takes a lookup config as input.

The config has:

- `packageName`: the package's full name including scope if present (e.g. `@foo/bar`)
- `registryUrls`: an array of registry URLs to try

`getReleases` should return an object having:

- `releases`: an array of strings of matched versions. This is the only mandatory field
- `deprecationMessage`: a string description of the package's deprecation notice, if applicable
- `sourceUrl`: a HTTP URL pointing to the source code (for example on GitHub)
- `homepage`: a HTTP URL for the package's homepage. Ideally should be empty if the homepage and `sourceUrl` are the same
- `changelogUrl`: a URL pointing to the package's changelog (could be a Markdown file, for example). If not present then Renovate will search the `sourceUrl` for a changelog file
- `tags`: an object mapping tag -> version, for example `tags: { latest: '3.0.0' }`. This is only used by the `followTags` function

## getDigest

Datasources that support digests (like Docker digests and Git commit hashes) can export a `getDigest` function.

The `getDigest` function has two inputs:

- `config`: the Renovate config for the package being updated, has the same fields as `getReleases`
- `newValue`: the version or value to retrieve the digest for

The `getDigest` function returns a string output representing the digest value.
If no digest is found, the `getDigest` function should return `null`.
