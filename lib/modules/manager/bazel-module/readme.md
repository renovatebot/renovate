The `bazel-module` manager can update [Bazel module (bzlmod)](https://bazel.build/external/module) enabled workspaces.

### Maven

It also takes care about maven artifacts initalized with [bzlmod](https://github.com/bazelbuild/rules_jvm_external/blob/master/docs/bzlmod.md). For simplicity the name of extension variable is limited to `maven*`. E.g.:

```
maven = use_extension("@rules_jvm_external//:extensions.bzl", "maven")
```

```
maven_1 = use_extension("@rules_jvm_external//:extensions.bzl", "maven")
```

Both `install` and `artifact` methods are supported:

```
maven.install(
    artifacts = [
        "org.seleniumhq.selenium:selenium-java:4.4.0",
    ],
)

maven.artifact(
    artifact = "javapoet",
    group = "com.squareup",
    neverlink = True,
    version = "1.11.1",
)
```

### Docker

Similarly, it updates Docker / OCI images pulled with [oci_pull](https://github.com/bazel-contrib/rules_oci/blob/main/docs/pull.md).

Note that the extension must be called `oci`:

```
oci = use_extension("@rules_oci//oci:extensions.bzl", "oci")

oci.pull(
    name = "nginx_image",
    digest = "sha256:287ff321f9e3cde74b600cc26197424404157a72043226cbbf07ee8304a2c720",
    image = "index.docker.io/library/nginx",
    platforms = ["linux/amd64"],
    tag = "1.27.1",
)
```
