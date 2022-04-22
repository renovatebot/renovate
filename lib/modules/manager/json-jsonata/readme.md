The `json-jsonata` manager is designed to allow users to manually configure Renovate for how to find dependencies in JSON files that aren't detected by the built-in package managers.

This manager is unique in Renovate in that:

- It is configurable via [JSONata](https://jsonata.org/) queries.
- Through the use of the `jsonataManagers` config, multiple "JSONata managers" can be created for the same repository.
- It can extract any `datasource`.
