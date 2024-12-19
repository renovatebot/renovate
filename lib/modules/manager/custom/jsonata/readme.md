With `customManagers` using `JSONata` queries you can configure Renovate so it finds dependencies in JSON files, that are not detected by its other built-in package managers.

Renovate uses the `jsonata` package to process the `json` file content. Read about the [jsonata query language](https://docs.jsonata.org/overview.html) in their readme.

The JSONata manager is unique in Renovate in because:

- It is configurable via [JSONata](https://jsonata.org/) queries
- It can extract any `datasource`
- By using the `customManagers` config, you can create multiple "JSONata managers" the same repository

### Required Fields

The first two required fields are `fileMatch` and `matchStrings`:

- `fileMatch` works the same as any manager
- `matchStrings` is a `JSONata` custom manager concept and is used for configuring a jsonata queries

#### Information that Renovate needs about the dependency

Before Renovate can look up a dependency and decide about updates, it must have this info about each dependency:

| Info type                                            | Required | Notes                                                     | Docs                                                                           |
| :--------------------------------------------------- | :------- | :-------------------------------------------------------- | :----------------------------------------------------------------------------- |
| Name of the dependency                               | Yes      |                                                           |                                                                                |
| `datasource`                                         | Yes      | Example datasources: npm, Docker, GitHub tags, and so on. | [Supported datasources](../../datasource/index.md#supported-datasources)       |
| Version scheme to use. Defaults to `semver-coerced`. | Yes      | You may set another version scheme, like `pep440`.        | [Supported versioning schemes](../../versioning/index.md#supported-versioning) |

#### Required fields to be present in the resulting structure returned by the jsonata query

You must:

- Capture the `currentValue` of the dependency
- Capture the `depName` or `packageName`. Or use a template field: `depNameTemplate` and `packageNameTemplate`
- Capture the `datasource`, or a use `datasourceTemplate` config field

#### Optional fields you can include in the resulting structure

You may use any of these items:

- `depType`, or a use `depTypeTemplate` config field
- `versioning`, or a use `versioningTemplate` config field. If neither are present, Renovate defaults to `semver-coerced`
- `extractVersion`, or use an `extractVersionTemplate` config field
- `currentDigest`
- `registryUrl`, or a use `registryUrlTemplate` config field. If it's a valid URL, it will be converted to the `registryUrls` field as a single-length array
- `indentation`. It must be either empty, or whitespace only (otherwise `indentation` will be reset to an empty string)

### Usage

To configure it, use the following syntax:

```javascript
{
  "customManagers": [
    {
      "customType": "jsonata",
      "fileFormat": "json",
      "fileMatch": ["<file match pattern>"],
      "matchStrings": ['<query>'],
      ...
    }
  ]
}
```

Where `<query>` is a [JSONata](https://docs.jsonata.org/overview.html) query that transform the contents into a JSON object with the following schema:

To be effective with the JSONata manager, you should understand jsonata queries. But enough examples may compensate for lack of experience.

#### Example queries

Below are some example queries for the generic JSON manager.
You can also use the [JSONata test website](https://try.jsonata.org) to experiment with queries.

```json title="Dependencies spread in different nodes, and we want to limit the extraction to a particular node"
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

```json title="Dependencies spread in different nodes, and we want to extract all of them as if they were in the same node"
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

```json title="The dependency name is in a JSON node name and the version is in a child leaf to that node"
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

```json title="The name of the dependency and the version are both value nodes of the same parent node"
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

```json title="The name of the dependency and the version are in the same string"
{
  "packages": ["foo@1.2.3", "bar@4.5.6"]
}
```

Query:

```
$map($map(packages, function ($v) { $split($v, "@") }), function ($v) { { "depName": $v[0], "currentVersion": $v[1] } })
```

```json title="JSONata manager config to extract deps from package.json file in the renovate repository"
{
  "customType": "jsonata",
  "fileMatch": ["package.json"],
  "matchStrings": [
    "$each(dependencies, function($v, $k) { {\"depName\":$k, \"currentValue\": $v, \"depType\": \"dependencies\"}})",
    "$each(devDependencies, function($v, $k) { {\"depName\":$k, \"currentValue\": $v, \"depType\": \"devDependencies\"}})",
    "$each(optionalDependencies, function($v, $k) { {\"depName\":$k, \"currentValue\": $v, \"depType\": \"optionalDependencies\"}})",
    "{ \"depName\": \"pnpm\", \"currentValue\": $substring(packageManager, 5),  \"depType\": \"packageManager\"}"
  ],
  "datasourceTemplate": "npm"
}
```
