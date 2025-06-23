
workspace(name = "angular_bazel_example")

go_repository(
    name = "com_github_bitly_go-nsq",
    importpath = "github.com/bitly/go-nsq",
    tag = "v1.0.5"
)

go_repository(
   name = "com_github_google_uuid",
   importpath = "github.com/google/uuid",
   commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
)

go_repository(
    name = "com_gopkgin_mgo_v2",
    importpath = "gopkg.in/mgo.v2",
    tag = "v2"
)

git_repository(
    name = "build_bazel_rules_nodejs",
    remote = "https://github.com/bazelbuild/rules_nodejs.git",
    tag = "0.3.1",
)

load("@build_bazel_rules_nodejs//:defs.bzl", "node_repositories")
node_repositories(package_json = ["//:package.json"])

git_repository(
    name = "build_bazel_rules_typescript",
    remote = "https://github.com/bazelbuild/rules_typescript.git",
    tag = "0.6.1",
)

load("@build_bazel_rules_typescript//:defs.bzl", "ts_repositories")

ts_repositories()

http_archive(
    name="distroless",
    sha256="f7a6ecfb8174a1dd4713ea3b21621072996ada7e8f1a69e6ae7581be137c6dd6",
    strip_prefix="distroless-446923c3756ceeaa75888f52fcbdd48bb314fbf8",
    urls=["https://github.com/GoogleContainerTools/distroless/archive/446923c3756ceeaa75888f52fcbdd48bb314fbf8.tar.gz"]
)

http_archive(
  name = "bazel_toolchains",
    sha256 = "4b1468b254a572dbe134cc1fd7c6eab1618a72acd339749ea343bd8f55c3b7eb",
    strip_prefix = "bazel-toolchains-d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/bazel-toolchains/archive/d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4.tar.gz",
        "https://github.com/bazelbuild/bazel-toolchains/archive/d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4.tar.gz",
    ],
)

http_archive(
    name = "rules_nodejs",
    sha256 = "5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064",
    urls = [
      "https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz"
    ],
)

local_repository(
    name = "angular",
    path = "node_modules/@angular/bazel",
)

local_repository(
    name = "rxjs",
    path = "node_modules/rxjs/src",
)

git_repository(
    name = "io_bazel_rules_sass",
    remote = "https://github.com/bazelbuild/rules_sass.git",
    tag = "0.0.3",
)

load("@io_bazel_rules_sass//sass:sass.bzl", "sass_repositories")

sass_repositories()

git_repository(
    name = "com_github_bazelbuild_buildtools",
    remote = "https://github.com/bazelbuild/buildtools.git",
    # Note, this commit matches the version of buildifier in angular/ngcontainer
    commit = "b3b620e8bcff18ed3378cd3f35ebeb7016d71f71",
)

http_archive(
    name = "io_bazel_rules_go",
    url = "https://github.com/bazelbuild/rules_go/releases/download/0.7.1/rules_go-0.7.1.tar.gz",
    sha256 = "341d5eacef704415386974bc82a1783a8b7ffbff2ab6ba02375e1ca20d9b031c",
)

http_archive(
    name = "bazel_skylib",
    sha256 = "b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f",
    strip_prefix = "bazel-skylib-0.5.0",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
        "https://github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
    ],
)

http_archive(
    name="distroless",
    sha256="f7a6ecfb8174a1dd4713ea3b21621072996ada7e8f1a69e6ae7581be137c6dd6",
    strip_prefix="distroless-446923c3756ceeaa75888f52fcbdd48bb314fbf8",
    urls=["https://github.com/GoogleContainerTools/distroless/archive/446923c3756ceeaa75888f52fcbdd48bb314fbf8.tar.gz"]
)

load("@bazel_tools//tools/build_defs/repo:utils.bzl", "maybe")
maybe(
  http_archive,
  name = "io_bazel_rules_go",
  sha256 = "2b1641428dff9018f9e85c0384f03ec6c10660d935b750e3fa1492a281a53b0f",
  url = "https://github.com/bazelbuild/rules_go/releases/download/v0.29.0/rules_go-v0.29.0.zip",
)
maybe(
    http_archive,
    name = "bazel_gazelle",
    sha256 = "de69a09dc70417580aabf20a28619bb3ef60d038470c7cf8442fafcf627c21cb",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/bazel-gazelle/releases/download/v0.24.0/bazel-gazelle-v0.24.0.tar.gz",
        "https://github.com/bazelbuild/bazel-gazelle/releases/download/v0.24.0/bazel-gazelle-v0.24.0.tar.gz",
    ],
)
maybe(
    go_repository,
    name = "com_github_pkg_errors",
    commit = "816c9085562cd7ee03e7f8188a1cfd942858cded",
    importpath = "github.com/pkg/errors",
)

load("@io_bazel_rules_go//go:def.bzl", "go_rules_dependencies", "go_register_toolchains")

go_rules_dependencies()

go_register_toolchains()

container_pull(
    name = "py3_image_base",
    digest = "sha256:d5a717649fd93ea5b9c430d7f84e4c37ba219eb53bd73ed1d4a5a98e9edd84a7",
    registry = "gcr.io",
    repository = "distroless/python3-debian10",
    tag = "latest",
)

http_file(
    name="distroless",
    sha256="f7a6ecfb8174a1dd4713ea3b21621072996ada7e8f1a69e6ae7581be137c6dd6",
    strip_prefix="distroless-446923c3756ceeaa75888f52fcbdd48bb314fbf8",
    urls=["https://github.com/GoogleContainerTools/distroless/archive/446923c3756ceeaa75888f52fcbdd48bb314fbf8.tar.gz"]
)
