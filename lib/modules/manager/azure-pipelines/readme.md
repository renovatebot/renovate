The `azure-pipelines` manager is disabled by default.
This is because there's no way for Renovate to know whether new task versions are yet available with the Azure DevOps environment, so new versions proposed by Renovate could fail.

To opt into running it, set the following:

```json
{
  "azure-pipelines": {
    "enabled": true
  }
}
```

It works by container and repository resources from the `resources` block as well as tasks from `steps` blocks.

For example:

```yaml
resources:
  repositories:
    - type: github
      name: renovate/renovate
      ref: refs/heads/main
    - type: github
      name: user/repo
      ref: refs/tags/v0.5.1
  containers:
    - container: linux
      image: ubuntu:16.04
    - container: python
      image: python:3.7@sha256:3870d35b962a943df72d948580fc66ceaaee1c4fbd205930f32e0f0760eb1077

stages:
  - stage: StageOne
    jobs:
      - job: JobOne
        steps:
          - task: Bash@3
            inputs:
              script: 'echo Hello World'
```

Read the [resources block][resources-docs] and the [tasks block][tasks-docs] Azure Pipelines documentation for more information.

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

[resources-docs]: https://docs.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/resources?view=azure-pipelines
[tasks-docs]: https://docs.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/steps-task?view=azure-pipelines
