This `custom` datasource allows requesting version data from generic HTTP endpoints.

## Usage

The `customDatasources` option takes a record of `customDatasource` configs.
This example shows how to update the `k3s.version` file with a custom datasource and
a [regexManagers](../../manager/regex/):

Options:

| option                     | default | description                                                                                                                                                              |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| defaultRegistryUrlTemplate | ""      | url used if no `registryUrl` is provided when looking up new releases                                                                                                    |
| format                     | "json"  | format used by the API. Available values are: `json`, `plain`                                                                                                            |
| transformTemplates         | []      | [jsonata rules](https://docs.jsonata.org/simple) to transform the API output. Each rule will be evaluated after another and the result will be used as input to the next |

Available template variables:

- `packageName`

```json5
{
  regexManagers: [
    {
      fileMatch: ['k3s.version'],
      matchStrings: ['(?<currentValue>\\S+)'],
      // used for display and templating purposes, if combined with customDatasources
      depNameTemplate: 'k3s',
      versioningTemplate: 'semver-coerced',
      // if the datasource is prefixed with `custom.`, Renovate will try to find customDatasource with a fitting name
      datasourceTemplate: 'custom.k3s',
    },
  ],
  customDatasources: {
    k3s: {
      defaultRegistryUrlTemplate: 'https://update.k3s.io/v1-release/channels',
      transformTemplates: [
        '{"releases":[{"version": $$.(data[id = \'stable\'].latest),"sourceUrl":"https://github.com/k3s-io/k3s","changelogUrl":$join(["https://github.com/k3s-io/k3s/releases/tag/",data[id = \'stable\'].latest])}],"sourceUrl": "https://github.com/k3s-io/k3s","homepage": "https://k3s.io/"}',
      ],
    },
  },
}
```

After all transformations, the resulting json has to follow this formats:

Minimal-supported object:

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

All available options:

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

`Plain Format:`

If the format is set to `plain`, Renovate will call the HTTP endpoint with the `Accept` header value `text/plain`. The body of the response will be treated as plain text and will be converted into a JSON.

Suppose the body of the HTTP response is as follows::

```
1.0.0
2.0.0
3.0.0
```

When Renovate receives this response with the `plain` format, it will convert it into the following:

```json
{
  "releases": [
    {
      "version": "1.0.0"
    },
    {
      "version": "2.0.0"
    },
    {
      "version": "3.0.0"
    }
  ]
}
```

After the conversion, any `jsonata` rules defined in the `transformTemplates` section will be applied as usual to further process the JSON data.

## Examples

# K3s

You can use this configuration to request the newest version available to [K3s](https://k3s.io/)

```json5
{
  customDatasources: {
    k3s: {
      defaultRegistryUrlTemplate: 'https://update.k3s.io/v1-release/channels',
      transformTemplates: [
        '{"releases":[{"version": $$.(data[id = \'stable\'].latest),"sourceUrl":"https://github.com/k3s-io/k3s","changelogUrl":$join(["https://github.com/k3s-io/k3s/releases/tag/",data[id = \'stable\'].latest])}],"sourceUrl": "https://github.com/k3s-io/k3s","homepage": "https://k3s.io/"}',
      ],
    },
  },
}
```
