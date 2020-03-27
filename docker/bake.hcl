group "default" {
	targets = ["latest", "slim"]
}

target "base" {
  target = "base"
  cache-from = ["renovate/docker-build-cache:renovate-base"]
}

target "tsbuild" {
  target = "tsbuild"
  cache-from = [ "renovate/docker-build-cache:renovate-tsbuild"]
}

target "final" {
  target = "final"
}

target "settings" {
  inherits = ["base", "tsbuild", "final"]
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
