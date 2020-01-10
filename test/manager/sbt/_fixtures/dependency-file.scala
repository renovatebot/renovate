import sbt._

object Dependencies {

  val abcVersion = "1.2.3"

  val ujson = "com.example" %% "foo" % "0.7.1"

  lazy val abc = "com.abc" % "abc" % abcVersion
}
