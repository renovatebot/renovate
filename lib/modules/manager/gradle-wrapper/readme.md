Configuration for Gradle Wrapper updates. Changes here affect how Renovate updates the version of gradle in the wrapper, not how it uses the wrapper.

### Gradle Wrapper Memory Settings

Gradle Wrapper updates are performed via Gradle's `wrapper` task.
Renovate will use the configured memory settings, which default to `256m` for Java heap memory.

These settings can be configured in the Renovate configuration using the following options:

| option         | meaning                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `jvmMaxMemory` | Maximum heap size in MB for Gradle Wrapper, defaults to `256`.                                                   |
| `jvmMemory`    | Initial heap size in MB for Gradle Wrapper, must be less or equal to `jvmMaxMemory`, defaults to `jvmMaxMemory`. |

Example with the defaults:

```json
{
  "gradleWrapper": {
    "jvmMaxMemory": 256,
    "jvmMemory": 256
  }
}
```
