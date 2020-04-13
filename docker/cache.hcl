group "cache" {
	targets = ["cache-base", "cache-tsbuild", "cache-latest", "cache-slim"]
}

target "cache-base" {
  inherits = ["base"]
  cache-to = ["renovate/docker-build-cache:renovate-base"]

}

target "cache-tsbuild" {
  inherits = ["base", "tsbuild"]
  cache-to = ["renovate/docker-build-cache:renovate-tsbuild"]

}

target "cache-slim" {
  inherits = ["slim"]
  cache-to = ["renovate/docker-build-cache:renovate-slim"]
}

target "cache-latest" {
  inherits = ["latest"]
  cache-to = ["renovate/docker-build-cache:renovate-latest"]
}

