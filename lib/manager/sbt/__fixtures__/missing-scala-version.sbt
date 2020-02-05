libraryDependencies ++= Seq(
  "org.scalatest" %% "scalatest" % "3.0.0"
)

val sbtReleaseVersion = "1.0.13"
addSbtPlugin("com.github.gseitz" % "sbt-release" % sbtReleaseVersion)
