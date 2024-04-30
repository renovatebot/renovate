Extracts all Docker images and Batect bundles from Batect configuration files.

For updates to Batect itself, see [batect-wrapper](../batect-wrapper/index.md).

### Files searched

By default, the manager searches for files called `batect.yml` or `batect-bundle.yml`.

If you keep your Batect configuration in other files, you'll need to tell Renovate where to find them.
Files included in your main configuration file with `include` don't need to be listed.

You do this by creating a `"batect"` object in your `renovate.json` file.
This object should have a `fileMatch` array with regular expressions that match the configuration file names.

For example:

```json
{
  "batect": {
    "fileMatch": [
      "(^|/)batect(-bundle)?\\.yml$",
      "(^|/)my-other-batect-file\\.yml$",
      "^a-directory/[^/]*\\.yml$"
    ]
  }
}
```

### Bundle versioning

This manager assumes that any bundles referenced use tags for versioning, and that these tags use [SemVer](../../versioning/semver/index.md).
The implementation of SemVer is strict - versions must follow the `X.Y.Z` or `vX.Y.Z` format.
Versions that don't match this format (eg. `X.Y`) will be ignored.
