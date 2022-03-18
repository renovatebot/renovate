version := "1.0.1"

libraryDependencies ++= Seq(
  "org.scalatest" %% "scalatest" % "3.0.0"
)

val sbtReleaseVersion = "1.0.11"
addSbtPlugin("com.github.gseitz" % "sbt-release" % sbtReleaseVersion)
