`gradle-lite` is an an alternate manager for Gradle, and is written in JavaScript.
The main benefit of `gradle-lite` is that it doesn't need to invoke the `gradle` tool from and command line in order to extract dependencies.

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
