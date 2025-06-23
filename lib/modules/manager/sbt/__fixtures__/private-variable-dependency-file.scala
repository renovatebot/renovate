import sbt._

object Dependencies {
  val moreSettings = Seq(
    scalaVersion := "2.13.0-RC5"
  )

  private val abcVersion = "1.2.3"

  private lazy val ujson = "com.example" %% "foo" % "0.7.1"

  lazy val abc = "com.abc" % "abc" % abcVersion

  lazy val dependentLibraries = Seq(ujson, abc)
}
