The `bazel-module` manager can update [Bazel module (bzlmod)](https://bazel.build/external/module) enabled workspaces.

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
