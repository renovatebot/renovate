The `json` datasource allows to gather dependency information from generic endpoints or files.
These files or endpoints have to contain or return valid json objects in the following format:

Minimal supported returned object:

```json
{
  "releases": [
    {
      "version": "v1.1.0"
    },
    {
      "version": "v1.2.0"
    }
  ]
}
```

Complete supported object

```json
{
  "releases": [
    {
      "version": "v1.0.0",
      "isDeprecated": true,
      "releaseTimestamp": "2022-12-24T18:21Z",
      "changelogUrl": "https://github.com/demo-org/demo/blob/main/CHANGELOG.md#v0710",
      "sourceUrl": "https://github.com/demo-org/demo",
      "sourceDirectory": "monorepo/folder"
    }
  ],
  "sourceUrl": "https://github.com/demo-org/demo",
  "sourceDirectory": "monorepo/folder",
  "changelogUrl": "https://github.com/demo-org/demo/blob/main/CHANGELOG.md",
  "homepage": "https://demo.org"
}
```

`packageName` will be interpreted as [JSONata](https://jsonata.org/) query.
`registryUrl` is used to define an endpoint ( prefixed with `http://` or `https://`) or a local file ( prefixed with `file://`)

### Examples

#### One endpoint per dependency

API returns:

```json
{
  "releases": [
    {
      "version": "v1.1.0"
    },
    {
      "version": "v1.2.0"
    }
  ]
}
```

Datasource input:

```json
{
  "registryUrl": "https://my.api.com/org/mytest/package",
  "packageName": "*"
}
```

Will result in a call to `https://my.api.com/org/mytest/package` and the result will be directly used.

#### Multiple packages per endpoint

API returns:

```json
{
  "package": {
    "releases": [
      {
        "version": "v1.1.0"
      },
      {
        "version": "v1.2.0"
      }
    ]
  }
}
```

Datasource input:

```json
{
  "registryUrl": "https://my.api.com/org/mytest",
  "packageName": "package"
}
```

Will result in a call to `https://my.api.com/org/mytest` and a lookup for the `package` in the result.

#### Multiple packages with namespaces

API returns:

```json
{
  "namespace": {
    "package": {
      "releases": [
        {
          "version": "v1.1.0"
        },
        {
          "version": "v1.2.0"
        }
      ]
    }
  }
}
```

Datasource input:

```json
{
  "registryUrl": "https://my.api.com/org/mytest",
  "packageName": "namespace.package"
}
```

Will also result in a call to `https://my.api.com/org/mytest` and a lookup for the `package` in the result.
