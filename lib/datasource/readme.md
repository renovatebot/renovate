# Datasources

Datasources are used in Renovate primarily to fetch released versions of packages.

### getPkgReleases

The minimum exported interface for a datasource is a function called `getPkgReleases` that takes a lookup config as input.

The config contains:

- `lookupName`: the package's full name including scope if present (e.g. `@foo/bar`)
- `lookupType`: used only when there is a need to specify different types of lookups within the same datasource
- `registryUrls`: an array of registry Urls to try

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

- `config`: the Renovate config for the package being updated, contains same fields as `getPkgReleases`
- `newValue`: the version or value to retrieve the digest for

The `getDigest` function returns a string output representing the digest value. If none is found then a return value of `null` should be returned.

### getPreset

This function is supported by npm, github and gitlab for retrieving a Renovate preset.
