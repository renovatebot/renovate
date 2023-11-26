By default, the `galaxy-collection` datasource checks for dependencies on `https://galaxy.ansible.com`.

But you can set your own registries.
You can set a `source` in your `requirements.yaml` file, _or_ write a `packageRule` to set a new `registryURLs`.
This allows you to use renovate with a private automation hub.

```yaml title="Example config for requirements.yaml"
---
collections:
  - name: community.general
    version: 3.0.0
    source: https://hub.mydomain.com/api/galaxy/content/community/
```

**Usage example - renovate.json**

```json
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
