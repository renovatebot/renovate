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
