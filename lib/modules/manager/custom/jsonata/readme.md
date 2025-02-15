With `customManagers` using `JSONata` queries you can configure Renovate so it finds dependencies in JSON or YAML files, that are not detected by its other built-in package managers.

Renovate uses the `jsonata` package to process the `json` or `yaml` file content using the queries.

For more on the jsonata query language, read the [jsonata query language site](https://docs.jsonata.org/overview.html).

The JSONata manager is unique in Renovate, because:

- It can be used with any `datasource`
- It can be configured via [JSONata](https://jsonata.org/) queries
- You can create multiple "JSONata managers" in the same repository

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

- Capture the `currentValue` of the dependency _or_ use the `currentValueTemplate` template field
- Capture the `depName` or `packageName`. _Or_ use a template field: `depNameTemplate` and `packageNameTemplate`
- Capture the `datasource`, _or_ use the `datasourceTemplate` template field

#### Optional fields you can include in the resulting structure

You may use any of these items:

- `depType`, _or_ use the `depTypeTemplate` template field
- `versioning`, _or_ the use `versioningTemplate` template field. If neither are present, Renovate defaults to `semver-coerced`
- `extractVersion`, _or_ use the `extractVersionTemplate` template field
- `currentDigest`
- `registryUrl`, _or_ use the `registryUrlTemplate` template field. If it's a valid URL, it will be converted to the `registryUrls` field as a single-length array
- `indentation`. Must be empty, _or_ whitespace. Else Renovate restes only `indentation` to an empty string

### Usage

When you configure a JSONata manager, use the following syntax:

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

Overwrite the `<query>` placeholder text with your [JSONata](https://docs.jsonata.org/overview.html) query.
The JSONata query transforms the content to a JSON object, similar to the this:

```javascript title="dependencies information extracted usig jsonata query"
[
  {
    depName: 'some_dep',
    currentValue: '1.0.0',
    datasource: 'docker',
    versioning: 'semver',
  },
];
```

Creating your Renovate JSONata manager config is easier if you understand JSONata queries.
We recommend you follow these steps:

1. Read the official JSONata query language docs
2. Check our example queries below
3. You're ready to make your own config

Alternatively you can "try and error" to a working config, by adjusting our examples.

YAML files are parsed as multi document files.

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

```json title="The dependency name is in a JSON node name, and the version is in a child leaf to that node"
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

```json title="The dependency name and its version are both value nodes of the same parent node"
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

```json title="The dependency name and version are part of the same string"
{
  "packages": ["foo@1.2.3", "bar@4.5.6"]
}
```

Query:

```
$map($map(packages, function ($v) { $split($v, "@") }), function ($v) { { "depName": $v[0], "currentVersion": $v[1] } })
```

```json title="JSONata manager config to extract deps from a package.json file in the Renovate repository"
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

```yaml title="Dependencies in a single node, and we want to extract all of them"
packages:
  - version: 1.2.3
    package: foo
```

Query:

```
packages.{ "depName": package, "currentValue": version }
```

```yaml title="Dependencies in a single node in a multi document yaml, and we want to extract all of them"
packages:
  - version: 1.2.3
    package: foo
---
packages:
  - version: 1.2.5
    package: bar
```

Query:

```
packages.{ "depName": package, "currentValue": version }
```
