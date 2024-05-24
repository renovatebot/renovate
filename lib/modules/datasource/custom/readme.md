This `custom` datasource allows requesting version data from generic HTTP(S) endpoints.

## Usage

The `customDatasources` option takes a record of `customDatasource` configs.
This example shows how to update the `k3s.version` file with a custom datasource and a [regex](../../manager/regex/index.md) custom manager:

Options:

| option                     | default  | description                                                                                                                                                              |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| defaultRegistryUrlTemplate | `""`     | URL used if no `registryUrl` is provided when looking up new releases                                                                                                    |
| format                     | `"json"` | format used by the API. Available values are: `json`, `plain`, `yaml`, `html`                                                                                            |
| transformTemplates         | `[]`     | [JSONata rules](https://docs.jsonata.org/simple) to transform the API output. Each rule will be evaluated after another and the result will be used as input to the next |

Available template variables:

- `packageName`
- `currentValue`

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["k3s.version"],
      "matchStrings": ["(?<currentValue>\\S+)"],
      "depNameTemplate": "k3s",
      "versioningTemplate": "semver-coerced",
      "datasourceTemplate": "custom.k3s"
    }
  ],
  "customDatasources": {
    "k3s": {
      "defaultRegistryUrlTemplate": "https://update.k3s.io/v1-release/channels",
      "transformTemplates": [
        "{\"releases\":[{\"version\": $$.(data[id = 'stable'].latest),\"sourceUrl\":\"https://github.com/k3s-io/k3s\",\"changelogUrl\":$join([\"https://github.com/k3s-io/k3s/releases/tag/\",data[id = 'stable'].latest])}],\"sourceUrl\": \"https://github.com/k3s-io/k3s\",\"homepage\": \"https://k3s.io/\"}"
      ]
    }
  }
}
```

After all transformations, the resulting JSON must match one of these formats:

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
      "sourceDirectory": "monorepo/folder",
      "digest": "c667f758f9e46e1d8111698e8d3a181c0b10f430"
    }
  ],
  "sourceUrl": "https://github.com/demo-org/demo",
  "sourceDirectory": "monorepo/folder",
  "changelogUrl": "https://github.com/demo-org/demo/blob/main/CHANGELOG.md",
  "homepage": "https://demo.org"
}
```

### Formats

#### JSON

If `json` is used processing works as described above.
The returned body will be directly interpreted as JSON and forwarded to the transformation rules.

#### Plain

If the format is set to `plain`, Renovate will call the HTTP endpoint with the `Accept` header value `text/plain`.
The body of the response will be treated as plain text and will be converted into JSON.

Suppose the body of the HTTP response is as follows:

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

#### Yaml

If `yaml` is used, response is parsed and converted into JSON for further processing.

Suppose the body of the HTTP response is as follows:

```yaml
releases:
  - version: 1.0.0
  - version: 2.0.0
  - version: 3.0.0
```

When Renovate receives this response with the `yaml` format, it will convert it into the following:

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

#### HTML

If the format is set to `html`, Renovate will call the HTTP endpoint with the `Accept` header value `text/html`.
The body of the response will be treated as a HTML document, and all hyperlinks will be converted to versions.

For the following HTML document:

```html
<html>
  <body>
    <a href="package-1.0.tar.gz">package-1.0.tar.gz</a>
    <a href="package-2.0.tar.gz">package-2.0.tar.gz</a>
  </body>
</html>
```

The following JSON will be generated:

```json
{
  "releases": [
    {
      "version": "package-1.0.tar.gz"
    },
    {
      "version": "package-1.0.tar.gz"
    }
  ]
}
```

After the conversion, any `jsonata` rules defined in the `transformTemplates` section will be applied to process the JSON data.

To extract the version number, you may use [`extractVersion`](../../../configuration-options.md#extractversion) or JSONata rules.

## Examples

### K3s

You can use this configuration to request the newest version available to [K3s](https://k3s.io/)

```json
{
  "customDatasources": {
    "k3s": {
      "defaultRegistryUrlTemplate": "https://update.k3s.io/v1-release/channels",
      "transformTemplates": [
        "{\"releases\":[{\"version\": $$.(data[id = 'stable'].latest),\"sourceUrl\":\"https://github.com/k3s-io/k3s\",\"changelogUrl\":$join([\"https://github.com/k3s-io/k3s/releases/tag/\",data[id = 'stable'].latest])}],\"sourceUrl\": \"https://github.com/k3s-io/k3s\",\"homepage\": \"https://k3s.io/\"}"
      ]
    }
  }
}
```

### Hashicorp

You can use this configuration to request the newest versions of the Hashicorp products:

```json
{
  "customManagers": [
    {
      "customType": "regex",
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
  }
}
```

To have the latest Nomad version in your Ansible variables, use this snippet _after_ adding the above configuration:

```yaml
# renovate: depName=nomad
nomad_version: 1.6.0
```

### Grafana Dashboard

You can use the following configuration to upgrade the Grafana Dashboards versions in your [Grafana Helm chart](https://github.com/grafana/helm-charts/blob/e5f1e9c4a4a3b43a820dc4b9eb16f3daa0b6e74f/charts/grafana/values.yaml#L685-L688):

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["\\.yml$"],
      "matchStrings": [
        "#\\s+renovate:\\s+depName=\"(?<depName>.*)\"\\n\\s+gnetId:\\s+(?<packageName>.*?)\\n\\s+revision:\\s+(?<currentValue>.*)"
      ],
      "versioningTemplate": "regex:^(?<major>\\d+)$",
      "datasourceTemplate": "custom.grafana-dashboards"
    }
  ],
  "customDatasources": {
    "grafana-dashboards": {
      "defaultRegistryUrlTemplate": "https://grafana.com/api/dashboards/{{packageName}}",
      "format": "json",
      "transformTemplates": [
        "{\"releases\":[{\"version\": $string(revision)}]}"
      ]
    }
  }
}
```

Grafana Helm chart `values.yaml` snippet:

```yml
dashboards:
  default:
    1860-node-exporter-full:
      # renovate: depName="Node Exporter Full"
      gnetId: 1860
      revision: 31
      datasource: Prometheus
    15760-kubernetes-views-pods:
      # renovate: depName="Kubernetes / Views / Pods"
      gnetId: 15760
      revision: 20
      datasource: Prometheus
```

### Custom offline dependencies

Sometimes the "dependency version source" is _not_ available via an API.
To work around a missing API, you can create dependency "files".
These files are served via HTTP(S), so that Renovate can access them.
For example, imagine the following file `versiontracker.json` for the software `something`:

```json
[
  {
    "version": "77"
  },
  {
    "version": "76"
  }
]
```

By writing a custom datasource, Renovate can process the `versiontracker.json` file, see below.
This example uses Nexus as the webserver.

```json
{
  "customDatasources": {
    "nexus_generic": {
      "defaultRegistryUrlTemplate": "https://nexus.example.com/repository/versiontrackers/{{packageName}}/versiontracker.json",
      "transformTemplates": [
        "{ \"releases\": $map($, function($v) { { \"version\": $v.version, \"sourceUrl\": $v.filelink } }) }"
      ]
    }
  }
}
```

This could be used to update Ansible YAML files with the latest version through a custom manager.
For example, with the following Ansible content:

```yaml
# renovate: datasource=custom.nexus_generic depName=something versioning=loose
something_version: '77'
```

And the following custom manager:

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["\\.yml$"],
      "datasourceTemplate": "custom.nexus_generic",
      "matchStrings": [
        "#\\s*renovate:\\s*(datasource=(?<datasource>.*?)\\s*)?depName=(?<depName>.*?)(\\s*versioning=(?<versioning>.*?))?\\s*\\w*:\\s*[\"']?(?<currentValue>.+?)[\"']?\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}"
    }
  ]
}
```

Or if you have the datasource locally, you can also define your local registry by prefixing it with `file://`:

```json
{
  "customDatasources": {
    "local_generic": {
      "defaultRegistryUrlTemplate": "file://dependencies/{{packageName}}/versiontracker.json",
      "transformTemplates": [
        "{ \"releases\": $map($, function($v) { { \"version\": $v.version, \"sourceUrl\": $v.filelink } }) }"
      ]
    }
  }
}
```

Renovate will then parse your file from your current folder to access it.

### nginx directory listing

Sometimes all you have is a directory with files, and a HTTP server that can generate directory listings.

Let's use nginx itself as an example:

```json
{
  "customDatasources": {
    "nginx": {
      "defaultRegistryUrlTemplate": "https://nginx.org/download",
      "format": "html"
    }
  },
  "packageRules": [
    {
      "matchDatasources": ["custom.nginx"],
      "extractVersion": "^nginx-(?<version>.+)\\.tar\\.gz$"
    }
  ]
}
```

### HTML page

You can use the `html` format to extract versions from a typical "Downloads" page:

```json
{
  "customDatasources": {
    "curl": {
      "defaultRegistryUrlTemplate": "https://curl.se/download.html",
      "format": "html"
    }
  },
  "packageRules": [
    {
      "matchDatasources": ["custom.curl"],
      "extractVersion": "/curl-(?<version>.+)\\.tar\\.gz$"
    }
  ]
}
```
