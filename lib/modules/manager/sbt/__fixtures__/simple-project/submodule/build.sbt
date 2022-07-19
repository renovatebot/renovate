import com.typesafe.tools.mima.core.{DirectMissingMethodProblem, IncompatibleMethTypeProblem, MissingClassProblem, ProblemFilters}

name := "simple-project-submodule"

exportJars := true

publishArtifact := true

libraryDependencies ++= Seq(
  //Akka
  "com.typesafe.akka"             %% "akka-stream"              % Versions.akka,

  "org.sangria-graphql"           %% "sangria-circe"            % Versions.sangriacirce,

  //Testing
  "org.scalatest"                 %%  "scalatest-wordspec"      % Versions.Tests.scalaTest  % Test,
  "org.scalatest"                 %%  "scalatest-funsuite"      % Versions.Tests.scalaTest  % Test,
  "org.mockito"                   %%  "mockito-scala-scalatest" % Versions.Tests.mockito    % Test,
  "com.github.tomakehurst"        %   "wiremock-jre8"           % Versions.Tests.wiremock   % Test,
  "com.softwaremill.sttp.client3"  %% "async-http-client-backend-future" % Versions.sttp     % Test,
)
