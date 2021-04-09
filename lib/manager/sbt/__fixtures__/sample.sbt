version := "1.0"

scalaVersion := "2.9.10"

// libraryDependencies += "org.example" % "foo" % "0.0.0"
libraryDependencies += "org.example" % "foo" % "0.0.1"
libraryDependencies += "org.example" %% "bar" % "0.0.2"
libraryDependencies ++= Seq(
  "org.example" %% "baz" % "0.0.3",  // comment
  "org.example" % "qux" % "0.0.4"    // comment
)
libraryDependencies += ("org.scala-lang" % "scala-library" % "2.13.3" classifier "sources") % Test

dependencyOverrides += "org.example" % "quux" % "0.0.5" // comment
dependencyOverrides ++= {
  val groupIdExample = "org.example" // comment
  val artifactIdExample = "corge"    // comment
  lazy val versionExample = "0.0.8"  // comment

  Seq(
    groupIdExample %% "quuz" % "0.0.6" % "test",           // comment
    "org.example" % artifactIdExample % "0.0.7" % Provided // comment
    ,"org.example" % "grault" % versionExample % Test,     // comment
  )
}

resolvers += "Repo #1" at "https://example.com/repos/1/"
resolvers ++= Seq(
  "Repo #2" at "https://example.com/repos/2/", // comment
  "Repo #3" at "https://example.com/repos/3/", // comment
  "Repo #4" at "https://example.com/repos/4/"  // comment
)
resolvers ++= Seq("Repo #5" at "https://example.com/repos/5/")

addSbtPlugin("org.example" % "waldo" % "0.0.9")

libraryDependencies += "org.example" % "fred" % "(,8.4.0]"
