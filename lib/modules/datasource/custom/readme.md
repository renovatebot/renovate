This `custom` datasource allows requesting version data from generic HTTP endpoints.

## Usage

The `customDatasources` option takes a record of `customDatasource` configs.
This example shows how to update the `k3s.version` file with a custom datasource and
a [regexManagers](../../manager/regex/):

Options:

| option                     | default | description                                                                                                                                                              |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| defaultRegistryUrlTemplate | ""      | url used if no `registryUrl` is provided when looking up new releases                                                                                                    |
| format                     | "json"  | format used by the API. Available values are: `json`                                                                                                                     |
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

## Examples

### K3s

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

### Hashicorp

You can use this configuration to request the newest versions of the hashicorp products:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["\\.yml$"],
      "datasourceTemplate": "custom.hashicorp",
      "matchStrings": [
        "#\\s*renovate:\\s*(datasource=(?<datasource>.*?) )?depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\s*\\w*:\\s*(?<currentValue>.*)\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}"
    }
  ],
  "customDatasources": {
    "hashicorp": {
      "defaultRegistryUrlTemplate": "https://api.releases.hashicorp.com/v1/releases/{{packageName}}?license_class=oss",
      "transformTemplates": [
        "{ \"releases\": $map($, function($v) { { \"version\": $v.version, \"releaseTimestamp\": $v.timestamp_created, \"changelogUrl\": $v.url_changelog, \"sourceUrl\": $v.url_source_repository } }), \"homepage\": $[0].url_project_website, \"sourceUrl\": $[0].url_source_repository }"
      ]
    }
  },
}
```

E.g. to have the latest Nomad version in your ansible variables, use this snippet after adding the above configuration:

```yaml
# renovate: depName=nomad
nomad_version: 1.6.0
```

### Custom Offline Dependencies

Sometimes the source of the dependency versions is not available via an API but has to be generated manually. For this purpose, you can manually create dependency "files" (similar to an API) served via http(s) for renovate to access. For example, imagine the following file `versiontracker.json` for the software `something``:

```json
[
    {
        "version": "77"
    },
    {
        "version": "76"
    },
]
```

Which can be ingested by renovate using the following custom datasource (using nexus as a webserver in this case):

```json
{
  "customDatasources": {
    "nexus_generic": {
      "defaultRegistryUrlTemplate": "https://nexus.example.com/repository/versiontrackers/{{packageName}}/versiontracker.json",
      "transformTemplates": [
        "{ \"releases\": $map($, function($v) { { \"version\": $v.version, \"sourceUrl\": $v.filelink } }) }"
      ]
    }
  },
}
```

This could be used to update ansible yaml files with the latest version through a regex manager, e.g. with the following ansible content:

```yaml
# renovate: datasource=custom.nexus_generic depName=something versioning=loose
something_version: "77"
```

And the following regex manager:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["\\.yml$"],
      "datasourceTemplate": "custom.nexus_generic",
      "matchStrings": [
        "#\\s*renovate:\\s*(datasource=(?<datasource>.*?) )?depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\s*\\w*:\\s*\"?(?<currentValue>.+?)\"?\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}"
    }
  ],
}
```
