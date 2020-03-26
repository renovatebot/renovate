group "default" {
	targets = ["latest", "slim"]
}
group "cache" {
	targets = ["cache-tsbuild", "cache-latest", "cache-slim"]
}

target "settings" {
  target = "final"
  cache-from = ["renovate/docker-build-cache:renovate-tsbuild"]
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

target "cache-tsbuild" {
  target = "tsbuild"
  cache-from = ["renovate/docker-build-cache:renovate-tsbuild"]
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

