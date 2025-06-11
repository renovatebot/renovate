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

In most cases only major version numbers are specified in YAML when referencing a task version: `NodeTool@0`.
By default, Renovate replaces these with the full version: `NodeTool@0.216.0`.

To use the standard convention for Azure Pipelines, add:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["azure-pipelines-tasks"],
      "extractVersion": "^(?<version>\\d+)"
    }
  ]
}
```

Renovate now updates container and repository resources from the `resources` block, plus tasks from `steps` blocks.

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
      image: ubuntu:24.04
    - container: python
      image: python:3.13@sha256:eec1b4e88e8762b4711b9f5fd69648b96ac04864e56993769cf50a9891a1d317

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

The `azure-pipelines` manager can process these files:

- `.azure-pipelines/**/*.yaml`
- `.azure-pipelines.yaml`
- `.azure-pipelines.yml`
- `azure-pipelines/**/*.yaml`
- `azure-pipelines.yaml`
- `azure-pipelines.yml`
- `azure-pipeline/**/*.yaml`
- `azure-pipeline.yaml`
- `azure-pipeline.yml`

<!-- prettier-ignore -->
!!! warning
    Renovate can't update (root) container-element in containers jobs, see [issue #21987](https://github.com/renovatebot/renovate/issues/21987).
    Renovate can't read Azure repositories defined in resource blocks, see [issue #15028](https://github.com/renovatebot/renovate/issues/15028).

[resources-docs]: https://docs.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/resources?view=azure-pipelines
[tasks-docs]: https://docs.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/steps-task?view=azure-pipelines
