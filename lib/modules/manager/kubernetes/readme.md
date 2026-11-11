The `kubernetes` manager has no `managerFilePatterns` default patterns, so it will not match any files until you configure it with a pattern.
This is because there is no commonly accepted file/directory naming convention for Kubernetes YAML files and we do not want to check every single `*.yaml` file in repositories just in case any of them have Kubernetes definitions.

If most `.yaml` files in your repository are Kubernetes ones, then you could add this to your config:

```json
{
  "kubernetes": {
    "managerFilePatterns": ["/\\.yaml$/"]
  }
}
```

If instead you have them all inside a `k8s/` directory, you would add this:

```json
{
  "kubernetes": {
    "managerFilePatterns": ["/k8s/.+\\.yaml$/"]
  }
}
```

Or if it is only a single file then something like this:

```json
{
  "kubernetes": {
    "managerFilePatterns": ["/^config/k8s\\.yaml$/"]
  }
}
```

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

### Extracted Dependencies

This manager extracts three different types of dependencies from Kubernetes YAML files.
As a first prerequisite, each file must contain the strings `apiVersion:` and `kind:` at least once (whitespace between the key and the colon is allowed).

For the exact regexes used by this manager, refer to the [source code](https://github.com/renovatebot/renovate/blob/main/lib/modules/manager/kubernetes/extract.ts).

#### Type 1: Extract Images

First, the manager looks for container images defined in the Kubernetes resource definitions.
This operates on the raw text line by line using a regex.
It matches all lines that start with `image:` (single leading dash and whitespace before the key are allowed, but whitespace before the colon is not allowed)
followed by a docker image string (whitespace and quotes around the image are allowed).

The match of the image string is extracted as a docker image dependency.

#### Type 2: Extract ImageVolumes

Next, the manager looks for image volumes defined in Kubernetes resource definitions.
For this extraction, each file must be a valid YAML file containing one or more Kubernetes resource definitions.
Each resource definition must contain an `apiVersion`, `kind`, and `metadata` field. The `metadata` field must include a `name` property.

- For resources of `kind` `Pod`, the manager extracts the values of `spec.volumes[].image.reference`.
- For resources of `kind`, `DaemonSet`, `Deployment`, `Job`, `ReplicaSet`, `ReplicationController`, and `StatefulSet`, the manager extracts the values of `spec.template.spec.volumes[].image.reference`.
- For resources of `kind` `CronJob`, the manager extracts the values of `spec.jobTemplate.spec.template.spec.volumes[].image.reference`.
- For all other resource kinds, the manager does not extract image volume references.

All extracted image volume references are extracted as docker image dependencies.

#### Type 3: Extract ApiVersions

Finally, the manager extracts the `apiVersion` field from each Kubernetes resource definition of supported APIs.
For this extraction, each file must be a valid YAML file containing one or more Kubernetes resource definitions.
In this case a dependency with the [`kubernetes-api` datasource](../../datasource/kubernetes-api.md) is created with the `kind` as the dep name and the `apiVersion` as the current value.

For supported APIs, see the [source code](https://github.com/renovatebot/renovate/blob/main/data/kubernetes-api.json5).
