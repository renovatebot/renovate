To enable this manager, add the matching files to `cdnurl.managerFilePatterns`.
For example:

```json
{
  "cdnurl": {
    "managerFilePatterns": ["/\\.html?$/"]
  }
}
```

<!-- prettier-ignore -->
!!! warning
    This manager does _not_ read or update Subresource Integrity (SRI) hashes.
    It replaces _any_ matching URL it finds, without adding or updating script integrity hashes.
    We recommend you use the `html` manager if you need SRI updating.
