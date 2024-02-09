variable "OWNER" {
  default = "renovatebot"
}
variable "FILE" {
  default = "renovate"
}
variable "RENOVATE_VERSION" {
  default = "unknown"
}
variable "RENOVATE_MAJOR_VERSION" {
  default = ""
}
variable "RENOVATE_MAJOR_MINOR_VERSION" {
  default = ""
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

group "push-cache" {
  targets = [
    "push-cache-slim",
    "push-cache-full",
  ]
}

target "settings" {
  dockerfile = "tools/docker/Dockerfile"
  args = {
    APT_HTTP_PROXY      = "${APT_HTTP_PROXY}"
    CONTAINERBASE_DEBUG = "${CONTAINERBASE_DEBUG}"
    RENOVATE_VERSION    = "${RENOVATE_VERSION}"
    GITHUB_TOKEN        = "${GITHUB_TOKEN}"
  }
}

target "slim" {
  cache-from = [
    "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}",
  ]
  tags = [
    "ghcr.io/${OWNER}/${FILE}",
    "ghcr.io/${OWNER}/${FILE}:${RENOVATE_VERSION}",
    "${FILE}/${FILE}",
    "${FILE}/${FILE}:${RENOVATE_VERSION}",
    notequal("", RENOVATE_MAJOR_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_MAJOR_VERSION}": "",
    notequal("", RENOVATE_MAJOR_MINOR_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_MAJOR_MINOR_VERSION}": "",
    notequal("", RENOVATE_MAJOR_VERSION) ? "${FILE}/${FILE}:${RENOVATE_MAJOR_VERSION}": "",
    notequal("", RENOVATE_MAJOR_MINOR_VERSION) ? "${FILE}/${FILE}:${RENOVATE_MAJOR_MINOR_VERSION}": "",

    // TODO: legacy, remove on next major
    "ghcr.io/${OWNER}/${FILE}-slim",
    "ghcr.io/${OWNER}/${FILE}:${RENOVATE_VERSION}-slim",
    "${FILE}/${FILE}-slim",
    "${FILE}/${FILE}:${RENOVATE_VERSION}-slim",
    notequal("", RENOVATE_MAJOR_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_MAJOR_VERSION}-slim": "",
    notequal("", RENOVATE_MAJOR_MINOR_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_MAJOR_MINOR_VERSION}-slim": "",
    notequal("", RENOVATE_MAJOR_VERSION) ? "${FILE}/${FILE}:${RENOVATE_MAJOR_VERSION}-slim": "",
    notequal("", RENOVATE_MAJOR_MINOR_VERSION) ? "${FILE}/${FILE}:${RENOVATE_MAJOR_MINOR_VERSION}-slim": "",
  ]
}

target "full" {
  args = {
    BASE_IMAGE_TYPE = "full"
  }
  cache-from = [
    "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}-full",
  ]
   tags = [
    "ghcr.io/${OWNER}/${FILE}:${RENOVATE_VERSION}-full",
    "ghcr.io/${OWNER}/${FILE}:full",
    "${FILE}/${FILE}:full",
    "${FILE}/${FILE}:${RENOVATE_VERSION}-full",
    notequal("", RENOVATE_MAJOR_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_MAJOR_VERSION}-full": "",
    notequal("", RENOVATE_MAJOR_MINOR_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_MAJOR_MINOR_VERSION}-full": "",
    notequal("", RENOVATE_MAJOR_VERSION) ? "${FILE}/${FILE}:${RENOVATE_MAJOR_VERSION}-full": "",
    notequal("", RENOVATE_MAJOR_MINOR_VERSION) ? "${FILE}/${FILE}:${RENOVATE_MAJOR_MINOR_VERSION}-full": "",
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
