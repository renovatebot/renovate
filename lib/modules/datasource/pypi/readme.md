This datasource uses the following logic to determine lookup URLs:

- If the normalized registryUrl ends in `/simple/` or `/+simple/` then only the simple API will be tried
- Otherwise, the JSON API will be tried first
- If the JSON API returns a result, it will be used
- If the JSON API throws an error (e.g. 403, 404) then the simple API will be tried

The simple API supports both the HTML serialization ([PEP 503](https://peps.python.org/pep-0503/)) and the JSON serialization ([PEP 691](https://peps.python.org/pep-0691/)).
Content negotiation is used to prefer the JSON serialization, falling back to HTML.
