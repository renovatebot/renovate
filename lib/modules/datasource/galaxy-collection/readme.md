By default, the `galaxy-collection` datasource checks for dependencies on `https://galaxy.ansible.com`.
But you can override the default if you want.

Set your own registries by:

- setting a `source` in your `requirements.yaml` file, _or_
- writing a `packageRule` to set a new `registryURLs`

Then you can use Renovate with a private automation hub.

```yaml title="Example config for requirements.yaml"
---
collections:
  - name: community.general
    version: 3.0.0
    source: https://hub.mydomain.com/api/galaxy/content/community/
```

```json title="Example config for renovate.json"
{
  "packageRules": [
    {
      "matchDatasources": ["galaxy-collection"],
      "registryUrls": [
        "https://hub.mydomain.com/api/galaxy/content/community/",
        "https://hub.mydomain.com/api/galaxy/content/certified/",
        "https://hub.mydomain.com/api/galaxy/content/myprivaterepo/"
      ]
    }
  ]
}
```
