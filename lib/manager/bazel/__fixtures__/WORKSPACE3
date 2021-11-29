    # Eigen already had a good BUILD file from Tensorflow.
# http_archive(
#     name = "rules_foreign_cc",
#     url = "https://github.com/bazelbuild/rules_foreign_cc/archive/dfccdce2c9d1063c59ddd331b94eb7cb528a96ee.tar.gz",
#     sha256 = "5469ef8b4e2c475de443c13290cf91ba7d1255899442b1e42fcb7fcdee8ceed8",
#     strip_prefix = "rules_foreign_cc-dfccdce2c9d1063c59ddd331b94eb7cb528a96ee",
# )
# load("@rules_foreign_cc//:workspace_definitions.bzl", "rules_foreign_cc_dependencies")
# rules_foreign_cc_dependencies()
# # Usage is a little weird, and depends
# FOREIGN_CC_EXPOSE_ALL_FILES = """filegroup(name = "all", srcs = glob(["**"]), visibility = ["//visibility:public"])"""


########################################
# C++ & Cross-Platform Libraries

# Boost.
# Famous C++ library that gives rise to many new additions in the C++ standard library.
# See https://github.com/nelhage/rules_boost, recommended from https://docs.bazel.build/versions/master/rules.html
http_archive(
    name = "com_github_nelhage_rules_boost",
    url = "https://github.com/nelhage/rules_boost/archive/98495a618246683c9058dd87c2c78a2c06087999.tar.gz",
    sha256 = "f92cb7ed66a5b24f97a7fc3917407f808c70d2689273bdd68f93d70a379d22d3",
    strip_prefix = "rules_boost-98495a618246683c9058dd87c2c78a2c06087999",
)
load("@com_github_nelhage_rules_boost//:boost/boost.bzl", "boost_deps")
boost_deps() # Also pulls in a bunch of boost depenencies if you don't have them already. See https://github.com/nelhage/rules_boost/blob/master/boost/boost.bzl
