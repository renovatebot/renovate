The `maven` manager focuses on extracting dependencies from `pom.xml`.
It uses the official Maven versioning scheme.
XML files must declare official namespaces to be parsed correctly (see Maven documentation on [`pom.xml`](https://maven.apache.org/pom.html), [`extensions.xml`](https://maven.apache.org/configure.html#mvn-extensions-xml-file)).

It also supports [Image Customizations](https://docs.spring.io/spring-boot/maven-plugin/build-image.html#build-image.customization) of `spring-boot`'s OCI packaging.
Usage of `registryAliases` is possible only for container image references.

### Java constraints

Renovate detects the Java constraint from a literal `<java.version>` property in the POM or a resolved local parent POM.
A child POM inherits this constraint only when it has no `<java.version>` property.
An empty or whitespace-only child property disables inheritance, and a nonempty child property overrides the parent.
Unresolved placeholders do not produce a Java constraint.

This detection does not use `maven.compiler.release`, `maven.compiler.source`, `maven.compiler.target`, profiles, or remote effective POMs.

### Limitations

Currently maven properties are not supported for buildpack related dependencies.
