val ScalaVersion = "2.12.10"
val versionExample = "0.0.8"

version := "3.2.1"

scalaVersion := ScalaVersion

// libraryDependencies += "org.example" % "foo" % "0.0.0"
libraryDependencies += "org.example" % "foo" % "0.0.1"
libraryDependencies += "org.example" %% "bar" % "0.0.2"
libraryDependencies ++= Seq(
  "org.example" %% "baz" % "0.0.3",
  "org.example" % "qux" % "0.0.4"
)

dependencyOverrides += "org.example" % "quux" % "0.0.5"
dependencyOverrides ++= {
  val groupIdExample = "org.example"
  val artifactIdExample = "corge"

  Seq(
    groupIdExample %% "quuz" % "0.0.6" % "test",
    "org.example" % artifactIdExample % "0.0.7" % Provided
    ,"org.example" % "grault" % versionExample % Test,
  )
}

resolvers += "Repo #1" at "https://example.com/repos/1/"
resolvers ++= Seq(
  "Repo #2" at "https://example.com/repos/2/",
  "Repo #3" at "https://example.com/repos/3/",
  "Repo #4" at "https://example.com/repos/4/"
)
resolvers ++= Seq("Repo #5" at "https://example.com/repos/5/")

addSbtPlugin("org.example" % "waldo" % "0.0.9")
