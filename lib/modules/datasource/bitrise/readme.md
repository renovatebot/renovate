Renovate uses this datasource to fetch Bitrise steps from GitHub repositories.

| Renovate field | What value to use?                      |
| -------------- | --------------------------------------- |
| `packageName`  | Name of the Bitrise step                |
| `registryUrl`  | GitHub HTTP Git URL, as used by Bitrise |

For example, in the YAML snippet below:

- `packageName` is `script`
- `registryUrl` is `https://github.com/bitrise-io/bitrise-steplib.git`

```yaml
format_version: 11
default_step_lib_source: https://github.com/bitrise-io/bitrise-steplib.git
project_type: android
app:
  envs:
    - MY_NAME: My Name
workflows:
  test:
    steps:
      - script@1.1.5:
          inputs:
            - content: echo "Hello ${MY_NAME}!"
```

### Authorizing Renovate to access Bitrise steps for self-hosted

Renovate will use the provided tokens for Github.com to authorize access to Bitrise steps.
If you are using a self-hosted Bitrise and use not the default registry, you will need to provide a token for Renovate to access the Bitrise steps.

```json title="Host Rule which matches the Bitrise step lib repository and datasource"
{
  "hostRules": [
    {
      "hostType": "bitrise",
      "matchHost": "https://api.github.com/repos/my-org/my-repo/contents",
      "token": "< Github.com token >"
    }
  ]
}
```
