This datasource uses the following logic to determine lookup URLs:

- If the normalized registryUrl ends in `/simple/` or `/+simple/` then only the simple API will be tried
- Otherwise, the JSON API will be tried first
- If the JSON API returns a result, it will be used
- If the JSON API throws an error (e.g. 403, 404) then the simple API will be tried

The Simple API supports both the HTML serialization ([PEP 503](https://peps.python.org/pep-0503/)) and the JSON serialization ([PEP 691](https://peps.python.org/pep-0691/)).
Renovate uses content negotiation (an `Accept` header) to prefer the JSON serialization, falling back to HTML automatically if the registry does not support it.
If the registry responds `406` because it cannot serve any of the negotiated types, Renovate retries the request without that header.

Renovate reads the release timestamp from the `upload_time` of a version's files, or the `upload-time` ([PEP 700](https://peps.python.org/pep-0700/)), which the Simple JSON API exposes, so [`minimumReleaseAge`](../../../configuration-options.md#minimumreleaseage) works against it.

If you are using Artifactory, you must [explicitly enable the generation of `upload-time` metadata server-side](https://jfrog.com/help/r/artifactory-enabling-time-based-package-filtering-for-pypi-repositories).
