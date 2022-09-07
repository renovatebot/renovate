[Tekton](https://tekton.dev/) is an open-source cloud-native Continuous Integration and Continuous Delivery/Deployment solution.

Tekton uses Tasks to capture specific commands to be executed, and Pipelines to combine different Tasks, to achieve a goal, like building a container image.
Tasks and Pipelines are defined as Kubernetes custom resources.

The [Tekton documentation](https://tekton.dev/docs/) is a great resource to learn more about the overall concepts and how to start using it.

### Distributing Tasks and Pipeline definitions

There are different ways to distribute Task and Pipeline definitions.
They can be created directly as a Kubernetes resource with standard tools like `kubectl`.
Tasks and Pipeline definitions can also live outside the Kubernetes cluster and get fetched by Tekton when needed, this approach relies on Tekton resource references rather than the resource definition.
The `tekton` manager focuses on providing updates to Tekton resource references.

Right now, Renovate's Tekton manager only supports references that are [Bundles](https://tekton.dev/docs/pipelines/tekton-bundle-contracts/).
See the [`tektoncd/resolution` project on GitHub](https://github.com/tektoncd/resolution) for the different kinds of Tekton references.

### Using a Tekton Bundle reference

There are two ways to use a Tekton Bundle reference:

1. Via the [`tektoncd/resolution` project](https://github.com/tektoncd/resolution)
2. Via the `taskRun.spec.taskRef.bundle` and the `pipelineRun.spec.pipelineRef.bundle` attributes

Renovate's Tekton manager supports both methods.

### Set your own `fileMatch` pattern

The `tekton` manager does not have a default `fileMatch` pattern.
This means it won't match any files until you set a `fileMatch` pattern.
This is to avoid problems with unrelated YAML files since there is no well-established file name pattern for [Tekton](https://tekton.dev/) resources.
As an example, the following config matches all the YAML files in a repository:

```json
{
  "tekton": {
    "fileMatch": ["\\.yaml$", "\\.yml$"]
  }
}
```

See our [versioning](https://docs.renovatebot.com/modules/versioning/) documentation for details on the existing versioning rules and possible alterations.
