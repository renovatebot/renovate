# Datasources

Datasources are used in Renovate primarily to fetch released versions of packages.

### getPkgReleases

The minimum exported interface for a datasource is a function called `getPkgReleases` that takes a lookup object as first input,.

The lookup object contains:

- `lookupName`: the package's full name including scope if present (e.g. `@foo/bar`)
- `datasourceType` if a datasource includes more than one type of lookup (e.g. GitHub with tags and releases)
- `registryUrls`: an array of registry URLs to lookup, which should override any defaults
- `npmrc`: an npmrc file, used for npm/yarn/pnpm only,
- `compatibility`, a freeform object currently used by pypi to restrict lookups to python versions

In the simplest case, the datasource only needs to pay attention to `lookupName`.

`getPkgReleases` should return an object containing:

- `releases`: an array of strings of matched versions. This is the only mandatory field.
- `deprecationMessage`: a string description of the package's deprecation notice, if applicable
- `sourceUrl`: a HTTP URL pointing to the source code (e.g. on GitHub)
- `homepage`: a HTTP URL for the package's homepage. Ideally should be empty if the homepage and sourceUrl are the same
- `changelogUrl`: a URL pointing to the package's Changelog (could be a markdown file, for example). If not present then Renovate will search the `sourceUrl` for a changelog file.
- `tags`: an object mapping tag -> version, e.g. `tags: { latest: '3.0.0' }`. This is only used by the `followTags` function.

### getDigest

Datasources that support the concept of digests (e.g. docker digests and git commit hashes) also can export a `getDigest` function.

The `getDigest` function has two inputs:

- `config`: the Renovate config for the package being updated
- `newValue`: the version or value to retrieve the digest for

The `getDigest` function returns a string output representing the digest value. If none is found then a return value of `null` should be returned.

### getPreset

This function is supported by npm, github and gitlab for retrieving a Renovate preset.
