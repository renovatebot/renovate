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

It also supports Docker images pulled with [rules_img pull](https://github.com/tweag/rules_img/blob/main/docs/pull.md#pull):

```
pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
pull(
    name = "ubuntu",
    digest = "sha256:1e622c5f9ac0c0144d577702ba5f2cce79fc8e3cf89ec88291739cd4eee3b7b9",
    registry = "index.docker.io",
    repository = "library/ubuntu",
    tag = "24.04",
)
```

### Crate

It also supports Rust crate dependencies initialized with [rules_rust crate_universe](https://github.com/bazelbuild/rules_rust/tree/main/crate_universe). For simplicity the name of extension variable is limited to `crate*`. E.g.:

```starlark
crate = use_extension("@rules_rust//crate_universe:extension.bzl", "crate")
```

```starlark
crate_1 = use_extension("@rules_rust//crate_universe:extension.bzl", "crate")
```

The `spec` method is supported:

```starlark
crate.spec(
    package = "axum",
    version = "0.8.4",
)

crate.spec(
    package = "tokio",
    version = "1.45.1",
    features = [
        "full",
    ],
)

crate.spec(
    package = "custom_crate",
    git = "https://github.com/example/custom_crate.git",
    tag = "v1.0.0",
)
```
