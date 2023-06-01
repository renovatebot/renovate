This datasource returns releases from hyperlinks in an HTML page.

The source HTML page URL is `registryUrl`.

`packageName` is the regex that the target URLs should match. Its first
(and only) capture group becomes the package version.

URLs could point to files or directories, even non-existent, Renovate won't
try to fetch the content or headers.
