The `cnb-project-descriptor` manager updates Cloud Native Buildpacks project descriptor file (`project.toml`), which references builder and/or buildpack images by URIs.
Updates are performed if the `project.toml` file is found and it conforms to the [project descriptor](https://github.com/buildpacks/spec/blob/main/extensions/project-descriptor.md) specification.

__Note__: buildpacks in the `io.buildpacks.group` array must be configured with the docker reference (`uri`) for this manager to work.

```toml
[_]
schema-version = "0.2"

[io.buildpacks]
builder = "registry.corp/builder/noble:1.1.1"

[[io.buildpacks.group]]
uri = "docker://buildpacks/java:2.2.2"

[[io.buildpacks.group]]
uri = "buildpacks/nodejs:3.3.3"

[[io.buildpacks.group]]
uri = "file://local.oci" # will be ignored
```
