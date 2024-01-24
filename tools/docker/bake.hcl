variable "OWNER" {
  default = "renovatebot"
}
variable "FILE" {
  default = "renovate"
}
variable "TAG" {
  default = "latest"
}
variable "RENOVATE_VERSION" {
  default = "unknown"
}

variable "APT_HTTP_PROXY" {
  default = ""
}

variable "CONTAINERBASE_DEBUG" {
  default = ""
}

variable "GITHUB_TOKEN" {
  default = ""
}

group "default" {
  targets = [
    "build",
  ]
}

group "build" {
  targets = [
    "build-slim",
    "build-full",
  ]
}

group "push" {
  targets = [
    "push-slim",
    "push-full",
    "push-cache-slim",
    "push-cache-full",
  ]
}

target "settings" {
  context = "tools/docker"
  args = {
    APT_HTTP_PROXY      = "${APT_HTTP_PROXY}"
    CONTAINERBASE_DEBUG = "${CONTAINERBASE_DEBUG}"
    RENOVATE_VERSION    = "${RENOVATE_VERSION}"
    GITHUB_TOKEN        = "${GITHUB_TOKEN}"
  }
  tags = [
    "ghcr.io/${OWNER}/${FILE}",
    "ghcr.io/${OWNER}/${FILE}:${TAG}",
  ]
}

target "slim" {
  cache-from = [
    "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}",
    "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}-${TAG}",
  ]
  tags = [
    "ghcr.io/${OWNER}/${FILE}",
    "ghcr.io/${OWNER}/${FILE}:${TAG}",
    "${FILE}/${FILE}",
    "${FILE}/${FILE}:${TAG}",
  ]
}

target "full" {
  args = {
    BASE_IMAGE_TYPE = "full"
  }
  cache-from = [
    "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}-full",
    "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}-${TAG}-full",
  ]
   tags = [
    "ghcr.io/${OWNER}/${FILE}:full",
    "ghcr.io/${OWNER}/${FILE}:${TAG}-full",
    "${FILE}/${FILE}:full",
    "${FILE}/${FILE}:${TAG}-full",
  ]
}

target "cache" {
  output   = ["type=registry"]
  cache-to = ["type=inline,mode=max"]
}

target "push-cache-slim" {
  inherits = [
    "settings",
    "cache",
    "slim",
  ]
  tags = [
    "ghcr.io/${OWNER}/docker-build-cache:${FILE}-${TAG}",
    "ghcr.io/${OWNER}/docker-build-cache:${FILE}",
  ]
}

target "push-cache-full" {
  inherits = [
    "settings",
    "cache",
    "full",
  ]
  tags = [
    "ghcr.io/${OWNER}/docker-build-cache:${FILE}-${TAG}-full",
    "ghcr.io/${OWNER}/docker-build-cache:${FILE}-full",
  ]
}

target "build-slim" {
  inherits = ["settings", "slim"]
}

target "build-full" {
  inherits = ["settings", "full"]

}

target "push-slim" {
  inherits = ["settings", "slim"]
  output   = ["type=registry"]
}

target "push-full" {
  inherits = ["settings", "full"]
  output   = ["type=registry"]
}
