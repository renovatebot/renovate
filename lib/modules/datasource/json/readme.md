The `json` datasource allows to gather dependency information from generic endpoints or files.
These files or endpoint have to contain or return valid json objects list in the following format

Allowed inputs:

```js
{
  registryUrl: 'https://my.api.com/org';
  packageName: 'mytest/package';
}
```

Will result in a call to `https://my.api.com/org/mytest`

Minimal JSON

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
