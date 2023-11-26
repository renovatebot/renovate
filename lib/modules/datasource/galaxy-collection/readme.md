By default, the `galaxy-collection` datasource checks for dependencies on `https://galaxy.ansible.com`.

However, you can override that behavior by either specifying a `source` in your `requirements.yaml` file or write a `packageRule` to provide other registryURLs.
This allows you to use renovate with a private automation hub.

**Usage example - requirements.yaml**

```yaml
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
