group "default" {
	targets = ["latest", "slim"]
}

group "cache" {
	targets = ["cache-base", "cache-tsbuild", "cache-latest", "cache-slim"]
}

target "base" {
  cache-from = ["renovate/docker-build-cache:renovate-base"]
}

target "tsbuild" {
  cache-from = [ "renovate/docker-build-cache:renovate-tsbuild"]
}

target "settings" {
  inherits = ["base", "tsbuild"]
  target = "final"
}

target "slim" {
  inherits = ["settings"]
  tags = ["renovate/renovate:slim"]
  args = { "IMAGE" = "slim" }
  cache-from = ["renovate/docker-build-cache:renovate-slim"]
}

target "latest" {
  inherits = ["settings"]
  tags = ["renovate/renovate"]
  cache-from = ["renovate/docker-build-cache:renovate-latest"]
}

target "cache-base" {
  inherits = ["base"]
  target = "base"
  cache-to = ["renovate/docker-build-cache:renovate-base"]

}

target "cache-tsbuild" {
  inherits = ["tsbuild"]
  target = "tsbuild"
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

