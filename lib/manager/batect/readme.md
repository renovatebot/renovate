Extracts all Docker images from Batect configuration files.

By default, the manager searches for files called `batect.yml` or `batect-bundle.yml`.

If you keep your Batect configuration in other files, you'll need to tell Renovate where to find them.
This includes files included into your main configuration file with `include`.

You do this by creating a `"batect"` object in your `renovate.json` file.
This object should contain a `fileMatch` array with regular expressions that match the configuration file names.

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
