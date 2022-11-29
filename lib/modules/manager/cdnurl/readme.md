To enable this manager, add the matching files to `cdnurl.fileMatch`.
For example:

```json
{
  "cdnurl": {
    "fileMatch": ["\\.html?$"]
  }
}
```

<!-- prettier-ignore -->
!!! warning
    This manager isn't aware of subresource integrity (SRI) hashes.
    It searches for and replaces _any_ matching URL it finds, without considering things like script integrity hashes.
    Use the `html` manager if you need SRI updating.
