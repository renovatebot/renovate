from kraken.common import buildscript

buildscript(
  index_url="https://artifactory.company.com/artifactory/api/pypi/python/simple",
  requirements=["package-one>=0.13.0", "package-two", "package-three[extra]<=0.14.5"],
)