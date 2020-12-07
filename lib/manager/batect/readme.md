Extracts all Docker images from Batect configuration files.

By default, this searches for files called `batect.yml` or `batect-bundle.yml`. If you use other file names for your
Batect configuration, you'll need to configure regular expressions for them in `renovate.json`:

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
