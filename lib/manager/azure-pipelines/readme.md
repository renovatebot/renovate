The `azure-pipelines` manager extracts container and repository resources from the `resources:` block. For example:

```yaml
resources:
  repositories:
    - type: github
      name: renovate/renovate
      ref: refs/heads/master
    - type: github
      name: user/repo
      ref: refs/tags/v0.5.1
  containers:
    - container: linux
      image: ubuntu:16.04
    - container: python
      image: python:3.7@sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077
```

More about the resources block can be found on the [Azure pipelines documentation](https://docs.microsoft.com/en-us/azure/devops/pipelines/yaml-schema?view=azure-devops&tabs=schema%2Cparameter-schema#resources).

Files that are processed by the manager includes:

- `.azure-pipelines/**/*.yaml`
- `.azure-pipelines.yaml`
- `.azure-pipelines.yml`
- `azure-pipelines/**/*.yaml`
- `azure-pipelines.yaml`
- `azure-pipelines.yml`
- `azure-pipeline/**/*.yaml`
- `azure-pipeline.yaml`
- `azure-pipeline.yml`
