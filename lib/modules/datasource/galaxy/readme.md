By default, the `galaxy` datasource looks for Ansible roles on `https://galaxy.ansible.com`.
You can override the default by writing a `packageRule` to set a new `registryURLs`.

```json title="Example config for renovate.json"
{
  "packageRules": [
    {
      "matchDatasources": ["galaxy"],
      "registryUrls": [
        "https://artifactory.example.com/artifactory/api/ansible/my-ansible-repo"
      ]
    }
  ]
}
```

If you give more than one registry, Renovate tries each one in turn and uses the first registry that has the role.
Automation Hub serves collections only, so use the `galaxy-collection` datasource for those.
