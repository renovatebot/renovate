This datasource uses the following logic to determine lookup URLs:

- If the normalized registryUrl ends in `/simple/` or `/+simple/` then only the simple API will be tried
- Otherwise, the JSON API will be tried first
- If the JSON API returns a result, it will be used
- If the JSON API throws an error (e.g. 403, 404) then the simple API will be tried

When using the simple API, Renovate sends an `Accept` header requesting the [PEP 691](https://peps.python.org/pep-0691/) JSON response format.
If the registry supports PEP 691, Renovate parses the JSON response, which includes `upload-time` for release timestamps.
If the registry does not support PEP 691, it returns HTML and Renovate falls back to standard HTML parsing automatically.
[Artifactory supports PEP 691 on an opt-in basis](https://jfrog.com/help/r/artifactory-enabling-time-based-package-filtering-for-pypi-repositories/artifactory-enabling-time-based-package-filtering-for-pypi-repositories).
