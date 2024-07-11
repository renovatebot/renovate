This datasource allows to fetch Bitrise steps from Git repositories.

**Currently only Github is support**

As `packageName` the step name expected e.g. for the following snippet the `packageName` would be `script`.

`registryUrl` expects a GitHub HTTP Git Url as used below by Bitrise. See the `default_step_lib_source` field for an example.

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
