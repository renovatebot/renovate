[Tekton](https://tekton.dev/) is an open-source cloud native CICD (Continuous Integration and Continuous Delivery/Deployment) solution.

It uses Tasks to capture specifics commands to be executed, and Pipelines to combine different Tasks in order to achieve a goal, e.g. build a container image.
Tasks and Pipelines are defined as Kubernetes custom resources.

Its [documentation](https://tekton.dev/docs/) is a great resource to learn more about the overall concepts and how to start using it.

There are different ways to distribute Task and Pipeline definitions.
They can be created directly as a Kubernetes resource with standard tools like `kubectl`.
They can also reside outside the Kubernetes cluster and fetched by Tekton itself when needed.
This second approach relies on Tekton resource references rather than the resource definition.
The `tekton` manager focuses on providing updates to Tekton resource references.

Currently, the manager only supports references that are [Bundles](https://tekton.dev/docs/pipelines/tekton-bundle-contracts/).
See the [tektoncd/resolution](https://github.com/tektoncd/resolution) project for the different kinds of Tekton references.

There are two ways to use a Tekton Bundle reference.
The first is via the previously mentioned [tektoncd/resolution](https://github.com/tektoncd/resolution) project, the second is via the `taskRun.spec.taskRef.bundle` and the `pipelineRun.spec.pipelineRef.bundle` attributes.
This manager supports both.

The `tekton` manager does not have a default `fileMatch` pattern.
It won't match any files until it is configured with a pattern.
This is to avoid unexpected issues with unrelated YAML files since there is no well-established file name pattern for [Tekton](https://tekton.dev/) resources.
As an example, the following config will match all the YAML files in a repository:

```json
{
  "tekton": {
    "fileMatch": ["\\.yaml$", "\\.yml$"]
  }
}
```

See the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation for details on the existing versioning rules and possible alterations.
