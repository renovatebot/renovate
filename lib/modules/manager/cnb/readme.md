The `cnb` manager updates Cloud Native Buildpacks project descriptors in `project.toml` files.
A `project.toml` file can reference builder / buildpack images by URIs.
Renovate can update a `project.toml` file if:

- It can find the file
- The file follows the [project descriptor](https://github.com/buildpacks/spec/blob/main/extensions/project-descriptor.md) specifications

If you use buildpacks in the `io.buildpacks.group` array, then you _must_ configure the Docker reference (uri`) for Renovate to work.

```toml title="Example of a `project.toml` file with Docker reference URIs"
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
