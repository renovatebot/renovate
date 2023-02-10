Renovate supports upgrading dependencies in [Kotlin Script](https://github.com/Kotlin/KEEP/blob/master/proposals/scripting-support.md) files.
Read the [Kotlin Script docs](https://kotlinlang.org/docs/custom-script-deps-tutorial.html) to learn more.
For example:

```kotlin
#!/usr/bin/env kotlin
@file:Repository("https://jitpack.io")
@file:DependsOn("com.github.krzema12:github-actions-kotlin-dsl:main-SNAPSHOT")
@file:DependsOn("org.eclipse.jgit:org.eclipse.jgit:4.6.0.201612231935-r")
@file:DependsOn("org.jetbrains.lets-plot:lets-plot-kotlin-jvm:3.0.2")

println("Hello world!")

// ...
```

By default, Renovate only scans files with the `.main.kts` extension and not `.kts`.
This way Renovate avoids ambiguity with Gradle config files that use the `.gradle.kts` extension.

If you want to manage other Kotlin Script files, you may use the `fileMatch` config option to let Renovate update these files:

```json
{
  "kotlin-script": {
    "fileMatch": ["^.*\\.kts$"]
  }
}
```
