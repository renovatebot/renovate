This datasource returns releases and digests for packages served via the [jsDelivr](https://www.jsdelivr.com/) CDN, using the [jsDelivr API](https://www.jsdelivr.com/docs/data.jsdelivr.com).

jsDelivr serves files from two different upstream sources, `npm` and `gh` (GitHub), using URLs like:

```
https://cdn.jsdelivr.net/npm/jquery@4.0.0/dist/jquery.min.js
https://cdn.jsdelivr.net/gh/jquery/jquery@4.0.0/dist/jquery.min.js
```

Because the same datasource can serve both kinds of packages, `packageName` must include the type as a prefix, mirroring jsDelivr's own package-identification scheme:

| Package type   | `packageName` format  | Example            |
| -------------- | --------------------- | ------------------ |
| npm (unscoped) | `npm/<name>`          | `npm/jquery`       |
| npm (scoped)   | `npm/<@scope>/<name>` | `npm/@babel/core`  |
| GitHub         | `gh/<owner>/<repo>`   | `gh/jquery/jquery` |

`registryUrl` defaults to `https://data.jsdelivr.com/v1/` and normally does not need to be set.

For `npm`-type packages, release fetching is delegated to the `npm` datasource (against the default npm registry) instead of querying jsDelivr's own API, so `registryUrl` has no effect on the release list for `npm`-type packages. Digest lookups always use jsDelivr's API directly, for both `npm` and `gh` types, since neither the `npm` registry nor GitHub expose an equivalent per-file content hash.
