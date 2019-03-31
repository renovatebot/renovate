## Overview

#### Name of package manager

sbt

---

#### What language does this support?

Scala

---

#### Does that language have other (competing?) package managers?

Maven

## Package File Detection

#### What type of package files and names does it use?

As far as I know, there is 2 package files:
- One for main dependencies and some configurations (https://www.scala-sbt.org/1.0/docs/Basic-Def.html)
- One for plugin dependencies and plugin configurations (https://www.scala-sbt.org/1.0/docs/Plugins.html)

---

#### What [fileMatch](https://renovatebot.com/docs/configuration-options/#filematch) pattern(s) should be used?

`['build\\.sbt', 'plugins\\.sbt']`

Note that `plugins.sbt` file is usually in a `project/` subdirectory.

---

#### Is it likely that many users would need to extend this pattern for custom file names?

Not likely.

---

#### Is the fileMatch pattern likely to get many "false hits" for files that have nothing to do with package management?

Not likely. The extension `.sbt` should not be used for other files.

## Parsing and Extraction

#### Can package files have "local" links to each other that need to be resolved?

No

#### Is there reason why package files need to be parsed together (in serial) instead of independently?

No

---

#### What format/syntax is the package file in? e.g. JSON, TOML, custom?

Scala syntax

---

#### How do you suggest parsing the file? Using an off-the-shelf parser, using regex, or can it be custom-parsed line by line?

I think reading the files with Scala would be the easier. Due to the fact that the files are plain Scala code, the
dependencies can be declared in multiple ways.

But, I guess there is two most commonly used way to declare dependencies and using regex could work for these formats.

Another option might be to use ScalaJS. I don't know it but it has same syntax as Scala and can be read/used within Javascript code.

If we can use Scala or ScalaJS, the idea would be to execute the `build.sbt` or `plugins.sbt` file and work on the `libraryDependencies` or `dependencyOverrides` variables.

_Update (thanks to @ChristianMurphy)_: https://github.com/scalameta/scalameta running on http://www.scala-js.org could be a way to parse Scala without depending on a JDK.
E.G. https://astexplorer.net/#/gist/027dce11e6927b4ad39ea097ce6289b9/ea4d1048f32063a71d727d01178ae6d01087a62f

---

#### Does the package file structure distinguish between different "types" of dependencies? e.g. production dependencies, dev dependencies, etc?

Dependencies can have a "scope" like `Test` or `Provided`.

Renovate shouldn't care of scopes: they should be kept as is but they don't have any impact on the "new dependency resolution".

---

#### List all the sources/syntaxes of dependencies that can be extracted:

##### build.sbt

Most common syntaxes:

```scala
// For Scala dependency with Scala version inferred (notice the double %%)
libraryDependencies += "com.typesafe.play" %% "play-ws" % "2.6.10"
// For Scala dependency without Scala version (2.12) inferred (single %)
libraryDependencies += "com.typesafe.play" % "play-ws_2.12" % "2.6.10"
// For Java dependency
libraryDependencies += "org.mockito" % "mockito-all" % "1.10.18"

// With a scope
libraryDependencies += "org.mockito" % "mockito-all" % "1.10.18" % Test

// Multiple dependencies at the same time
libraryDependencies ++= Seq(
  "com.typesafe.play" %% "play-ws" % "2.6.10",
  "org.mockito" % "mockito-all" % "1.10.18"
)

// Defining some dependency overriding
dependencyOverrides += "com.google.guava" % "guava" % "23.0"
// Multiple at once
dependencyOverrides ++= Seq(
  "org.scala-lang.modules" %% "scala-parser-combinators" % "1.1.0",
  "com.google.guava" % "guava" % "23.0"
)
```

There is two variables to look for `libraryDependencies` and `dependencyOverrides` (https://www.scala-sbt.org/1.x/docs/Library-Management.html#Overriding+a+version).

 `dependencyOverrides` behaves like "Dependency Management" in Maven: if two dependencies declared in `libraryDependencies` depends on the same library (let's say 'C') but with different version, `dependencyOverrides` is a way to force a specific version of 'C' instead of letting sbt choose (it would choose the highest).

More custom syntaxes with plain Scala code:

```scala
val myDependencyVersion = "2.6.10"
val myDependencyGroupId = "com.typesafe.play"
val myDependencyArtifactId = "play-json"
val myDependency: ModuleID = myDependencyGroupId %% myDependencyArtifactId % myDependencyVersion

libraryDependencies += myDependency
```

You could imagine some `if` statements as well as any other Scala syntax but I think it's pretty rare.

##### plugins.sbt

Most common syntaxes:

```scala
// Declaring a plugin
addSbtPlugin("com.eed3si9n" % "sbt-buildinfo" % "0.9.0")

// Defining some dependency overriding (same as for build.sbt)
dependencyOverrides += "org.webjars" % "webjars-locator-core" % "0.33"
// Multiple at once
dependencyOverrides ++= Seq(
  "org.webjars" % "webjars-locator-core" % "0.33",
  "org.codehaus.plexus" % "plexus-utils" % "3.0.17",
  "com.google.guava" % "guava" % "23.0"
)
```

---

#### Describe which types of dependencies above are supported and which will be implemented in future:

All to be supported.

## Versioning

#### What versioning scheme do the package files use?

Ivy (https://ant.apache.org/ivy/history/2.3.0/ivyfile/dependency.html#revision).

---

#### Does this versioning scheme support range constraints, e.g. `^1.0.0` or `1.x`?

Yes. With syntax like `[1.0,2.0]`. See https://ant.apache.org/ivy/history/2.3.0/ivyfile/dependency.html#revision.

Maven version ranges are supported as well (https://www.scala-sbt.org/1.x/docs/Library-Dependencies.html#Ivy+revisions).

---

#### Is this package manager used for applications, libraries, or both? If both, is there a way to tell which is which?

Both. No distinction.

---

#### If ranges are supported, are there any cases when Renovate should pin ranges to exact versions if rangeStrategy=auto?

Don't know. Someone more experienced with sbt should answer to this.

## Lookup

#### Is a new datasource required? Provide details

It could leverage the maven datasource.

---

#### Will users need the capability to specify a custom host/registry to look up? Can it be found within the package files, or within other files inside the repository, or would it require Renovate configuration?

Yes. Custom repositories can be defined with `resolvers` (https://www.scala-sbt.org/1.0/docs/Resolvers.html).

Resolvers can be defined within the package files and/or in other files outside the project. Thus, a Renovate configuration would be better and easier.

---

#### Do the package files contain any "constraints" on the parent language (e.g. supports only v3.x of Python) or platform (Linux, Windows, etc) that should be used in the lookup procedure?

Yes. It's possible to specify the Scala language version to use. This should be used in the lookup procedure.

```scala
// In build.sbt
scalaVersion := "2.12.7"
```

---

#### Will users need the ability to configure language or other constraints using Renovate config?

Not sure.

## Artifacts

#### Are lock files or checksum files used? Mandatory?

No.

---

#### If so, what tool and exact commands should be used if updating 1 or more package versions in a dependency file?

N/A.

---

#### If applicable, describe how the tool maintains a cache and if it can be controlled via CLI or env? Do you recommend the cache be kept or disabled/ignored?

sbt has a local cache in the `~/.ivy` folder.

Some configuration are possible (https://www.scala-sbt.org/1.0/docs/Cached-Resolution.html) but I think cache can be ignored for RenovateBot purpose.

---

#### If applicable, what command should be used to generate a lock file from scratch if you already have a package file? This will be used for "lock file maintenance".

N/A.

## Other

#### Is there anything else to know about this package manager?

N/A.
