group "default" {
	targets = ["renovate-latest", "renovate-slim"]
}

target "settings" {
  target = "final"
}

target "renovate-slim" {
  inherits = ["settings"]
  tags = ["renovate/renovate:slim"]
  args = { "IMAGE" = "slim" }
  cache-to = ["renovate/renovate:_cache-slim"]
  cache-from = ["renovate/renovate:_cache-slim"]
}

target "renovate-latest" {
  inherits = ["settings"]
  tags = ["renovate/renovate"]
  cache-to = ["renovate/renovate:_cache-latest"]
  cache-from = ["renovate/renovate:_cache-latest"]
}
