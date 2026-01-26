val versions = new {
  scala = "2.12.10"
  example = "0.0.8"
}
scalaVersion := versions.scala
version := "3.2.1"
libraryDependencies += "org.example" % "foo" % versions.example
