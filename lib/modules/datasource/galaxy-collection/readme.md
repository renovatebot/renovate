This datasource identifies ansible collection source repositories.
By default [https://galaxy.ansible.com](https://galaxy.ansible.com) is used.

Custom registries currently support the following:

- setting your own host - this assumes the same API as `https://galaxy.ansible.com` uses.
- setting a complete custom URL including pathes - e.g. if you use a private automation hub.

An example for the custom url:

```yaml
# cat requirements.yml
---
collections:
  - name: community.general
    version: 6.1.0
    source: https://automationhub.example.com/api/galaxy/content/community/v3/collection
```
