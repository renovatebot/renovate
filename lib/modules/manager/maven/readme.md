The `maven` manager focuses on extracting dependencies from `pom.xml`. It uses the official Maven versioning scheme.

XML files must declare official namespaces to be parsed correctly (see Maven documentation on [`pom.xml`](https://maven.apache.org/pom.html), [`extensions.xml`](https://maven.apache.org/configure.html#mvn-extensions-xml-file)).

It also supports [Image Customizations](https://docs.spring.io/spring-boot/maven-plugin/build-image.html#build-image.customization) of `spring-boot`'s OCI packaging. Usage of `registryAliases` is possible only for container image references.

### Limitations

Currently maven properties are not supported for buildpack related dependencies.
