It isn't supporting Scala version inference well (`%%` operator), just searching for package like `<artifactId>_<scalaVersion>` without any additional resolving.
In case of problems, please use explicit versions with `%` operator.
