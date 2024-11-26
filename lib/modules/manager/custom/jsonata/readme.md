The `json-jsonata` manager is designed to allow users to manually configure Renovate for how to find dependencies in JSON files that aren't detected by the built-in package managers.

This manager is unique in Renovate in that:

- It is configurable via [JSONata](https://jsonata.org/) queries.
- Through the use of the `jsonataManagers` config, multiple "JSONata managers" can be created for the same repository.
- It can extract any `datasource`.

To configure it, use the following syntax:

```
{
  "jsonataManagers": [
    {
      "fileMatch": ["<file match pattern>"],
      "matchQueries": ['<query>'],
      ...
    }
  ]
}
```

Where `<query>` is a [JSONata](https://docs.jsonata.org/overview.html) query that transform the contents into a JSON object with the following schema:

```json
{
  "depName": "<dep-name>",
  "packageName": "<package-name>",
  "currentValue": "<current-value>",
  "currentDigest": "<current-digest>",
  "datasource": "<data-source>",
  "versioning": "<versioning>",
  "extractVersion": "<extract-version>",
  "registryUrl": "<registry-url>",
  "depType": "<dep-type>"
}
```

The meaning of each field is the same as the meaning of the capturing groups for regex managers.

The following configuration is also available for each `jsonManager` element, again with the same meaning as for the regex manager:

- `depNameTemplate`.
- `packageNameTemplate`.
- `currentValueTemplate`.
- `currentDigestTemplate`.
- `datasourceTemplate`.
- `versioningTemplate`.
- `extractVersionTemplate`.
- `registryUrlTemplate`.
- `depTypeTemplate`.

### Example queries

Below are some example queries for the generic JSON manager. You can also use the [JSONata test website](https://try.jsonata.org) to experiment with queries.

_Dependencies spread in different nodes, and we want to limit the extraction to a particular node:_

```json
{
  "production": [
    {
      "version": "1.2.3",
      "package": "foo"
    }
  ],
  "development": [
    {
      "version": "4.5.6",
      "package": "bar"
    }
  ]
}
```

Query:

```
production.{ "depName": package, "currentValue": version }
```

_Dependencies spread in different nodes, and we want to extract all of them as if they were in the same node:_

```json
{
  "production": [
    {
      "version": "1.2.3",
      "package": "foo"
    }
  ],
  "development": [
    {
      "version": "4.5.6",
      "package": "bar"
    }
  ]
}
```

Query:

```
*.{ "depName": package, "currentValue": version }
```

_The dependency name is in a JSON node name and the version is in a child leaf to that node_:

```json
{
  "foo": {
    "version": "1.2.3"
  },
  "bar": {
    "version": "4.5.6"
  }
}
```

Query:

```
$each(function($v, $n) { { "depName": $n, "currentValue": $v.version } })
```

_The name of the dependency and the version are both value nodes of the same parent node:_

```json
{
  "packages": [
    {
      "version": "1.2.3",
      "package": "foo"
    },
    {
      "version": "4.5.6",
      "package": "bar"
    }
  ]
}
```

Query:

```
packages.{ "depName": package, "currentValue": version }
```

_The name of the dependency and the version are in the same string:_

```json
{
  "packages": ["foo@1.2.3", "bar@4.5.6"]
}
```

Query:

```
$map($map(packages, function ($v) { $split($v, "@") }), function ($v) { { "depName": $v[0], "currentVersion": $v[1] } })
```
