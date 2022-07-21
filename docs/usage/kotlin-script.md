---
title: Kotlin Script dependency versions
description: Kotlin Script dependency versions support in Renovate
---

# Kotlin Script dependency versions

Renovate supports upgrading dependencies in [Kotlin Script](https://github.com/Kotlin/KEEP/blob/master/proposals/scripting-support.md) files.
These are self-contained scripts where one can write Kotlin code with JVM backend, and compilation happens when the
scripts are ran. For example:

```kotlin
#!/usr/bin/env kotlin
@file:Repository("https://jitpack.io")
@file:DependsOn("com.github.krzema12:github-actions-kotlin-dsl:main-SNAPSHOT")
@file:DependsOn("org.eclipse.jgit:org.eclipse.jgit:4.6.0.201612231935-r")
@file:DependsOn("org.jetbrains.lets-plot:lets-plot-kotlin-jvm:3.0.2")

println("Hello world!")

// ...
```

By default, Renovate scans files with `.main.kts` extension. There are cases where just `.kts` extension or no extension
is used, and in that case Renovate can be configured to scan also these.
