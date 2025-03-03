variable "OWNER" {
  default = "renovatebot"
}
variable "FILE" {
  default = "renovate"
}
variable "RENOVATE_VERSION" {
  default = ""
}
variable "RENOVATE_MAJOR_VERSION" {
  default = ""
}
variable "RENOVATE_MAJOR_MINOR_VERSION" {
  default = ""
}
variable "CHANNEL" {
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
  # cache-from = [
  #   "type=registry,ref=ghcr.io/${OWNER}/${FILE}",
  #   "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}",
  # ]
  tags = [
    notequal("", CHANNEL)
      ? "ghcr.io/${OWNER}/${FILE}:${CHANNEL}"
      : "ghcr.io/${OWNER}/${FILE}",
    notequal("", CHANNEL)
      ? "${FILE}/${FILE}:${CHANNEL}"
      : "${FILE}/${FILE}",

    // GitHub versioned tags
    notequal("", RENOVATE_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_VERSION}": "",
    notequal("", RENOVATE_MAJOR_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_MAJOR_VERSION}": "",
    notequal("", RENOVATE_MAJOR_MINOR_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_MAJOR_MINOR_VERSION}": "",

    // Docker Hub versioned tags
    notequal("", RENOVATE_VERSION) ? "${FILE}/${FILE}:${RENOVATE_VERSION}": "",
    notequal("", RENOVATE_MAJOR_VERSION) ? "${FILE}/${FILE}:${RENOVATE_MAJOR_VERSION}": "",
    notequal("", RENOVATE_MAJOR_MINOR_VERSION) ? "${FILE}/${FILE}:${RENOVATE_MAJOR_MINOR_VERSION}": "",
  ]
}

target "full" {
  args = {
    BASE_IMAGE_TYPE = "full"
  }
  # cache-from = [
  #   "type=registry,ref=ghcr.io/${OWNER}/${FILE}:full",
  #   "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}-full",
  # ]
  tags = [
    notequal("", CHANNEL) ? "ghcr.io/${OWNER}/${FILE}:${CHANNEL}-full" : "ghcr.io/${OWNER}/${FILE}:full",
    notequal("", CHANNEL) ? "${FILE}/${FILE}:${CHANNEL}-full" : "${FILE}/${FILE}:full",

    // GitHub versioned tags
    notequal("", RENOVATE_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_VERSION}-full": "",
    notequal("", RENOVATE_MAJOR_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_MAJOR_VERSION}-full": "",
    notequal("", RENOVATE_MAJOR_MINOR_VERSION) ? "ghcr.io/${OWNER}/${FILE}:${RENOVATE_MAJOR_MINOR_VERSION}-full": "",

    // Docker Hub versioned tags
    notequal("", RENOVATE_VERSION) ? "${FILE}/${FILE}:${RENOVATE_VERSION}-full": "",
    notequal("", RENOVATE_MAJOR_VERSION) ? "${FILE}/${FILE}:${RENOVATE_MAJOR_VERSION}-full": "",
    notequal("", RENOVATE_MAJOR_MINOR_VERSION) ? "${FILE}/${FILE}:${RENOVATE_MAJOR_MINOR_VERSION}-full": "",
  ]
}

target "build-slim" {
  inherits = ["settings", "slim"]
}

target "build-full" {
  inherits = ["settings", "full"]
}

target "push-slim" {
  inherits = ["build-slim"]
  output   = ["type=registry"]
  cache-to = [
    notequal("", CHANNEL)
      ? "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}-${CHANNEL},mode=max,image-manifest=true,ignore-error=true"
      : "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE},mode=max,image-manifest=true,ignore-error=true",
  ]
}

target "push-full" {
  inherits = ["build-full"]
  output   = ["type=registry"]
  cache-to = [
    notequal("", CHANNEL)
      ? "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}-${CHANNEL}-full,mode=max,image-manifest=true,ignore-error=true"
      : "type=registry,ref=ghcr.io/${OWNER}/docker-build-cache:${FILE}-full,mode=max,image-manifest=true,ignore-error=true",
  ]
}
