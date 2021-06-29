`gradle-lite` is an an alternate manager for Gradle, and is written in JavaScript.
The main benefit of `gradle-lite` is that it doesn't need to invoke the `gradle` tool from the command line in order to extract the dependencies.

To enable `gradle-lite`:

```json
{
  "extends": [":enableGradleLite"]
}
```

To disable the original `gradle` manager if `gradle-lite` satisfies all requirements:

```json
{
  "extends": [":switchToGradleLite"]
}
```

Feedback for this manager would be welcome as we would like to switch it to be the default manager for Gradle soon.

`gradle-lite` supports the following version definition strategies:

- Version defined as a plain string in a `*.gradle` file, for example: `"org.springframework.boot:spring-boot-starter-web:2.5.1"`

- Version defined as a local variable:

  - In `build.gradle`:

    ```
    def springBoot='2.5.1'
    ...
    "org.springframework.boot:spring-boot-starter-web:$springBoot"
    ```

- Version defined as a variable in the accompanying `*.properties` file:
  - In `gradle.properties`: `springBoot=2.5.1`
  - In `build.gradle`: `"org.springframework.boot:spring-boot-starter-web:$springBoot"`

Variables defined in other custom locations are not currently supported.

See the [Gradle documentation](https://docs.gradle.org/current/userguide/build_environment.html#sec:gradle_configuration_properties) for details on defining variables.
