#!/usr/bin/env kotlin
@file:Repository("https://jitpack.io")
@file:DependsOn("it.krzeminski:github-actions-kotlin-dsl:0.22.0")
@file:DependsOn("org.eclipse.jgit:org.eclipse.jgit:4.6.0.201612231935-r")
@file:Repository("https://some.other.repo/foo/bar/baz")
@file:Repository("")

// ...

println("Hello world")
