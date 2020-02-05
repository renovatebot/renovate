libraryDependencies ++= Seq(
  "org.scalatest" %% "scalatest" % "3.2.0-SNAP10"
)

val sbtReleaseVersion = "1.0.11"
addSbtPlugin("com.github.gseitz" % "sbt-release" % sbtReleaseVersion)
