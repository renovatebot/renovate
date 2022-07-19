name := "simple-project"

inThisBuild(
  List(
    organization := "com.org.commons",
    scalaVersion := "2.13.8",
    crossScalaVersions := Seq(scalaVersion.value, "2.12.15"),
    mimaFailOnNoPrevious := false,
    scalafmtOnCompile := true
  )
)

lazy val noPublishSettings = Seq(
  publish := {},
  publishLocal := {},
  publishArtifact := false
)

val earliestCompatibleVersion = Set.empty

lazy val submodule = project.in(file("submodule"))
  .settings(noPublishSettings ++ Seq(
    libraryDependencies ++= Seq(
      "io.circe"          %% "circe-generic"  % Versions.circe,
      "com.typesafe.akka" %% "akka-http"      % Versions.akkaHttp
    )
  ))
  .disablePlugins(MimaPlugin)
  .dependsOn(circe)

lazy val root = project.in(file("."))
  .settings(noPublishSettings ++ Seq(
    // Demo dependencies
    libraryDependencies ++= Seq(
      "com.typesafe.akka" %% "akka-stream"          % Versions.akka,
      "ch.qos.logback"    % "logback-classic"       % "1.2.11"
    )
  ))
  .disablePlugins(MimaPlugin)
  .dependsOn(performance, server)
  .aggregate(submodule)
