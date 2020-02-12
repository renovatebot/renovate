#!/bin/bash
set -e

PLATFORM=${PLATFORM-linux/amd64}
DOCKER_REPO=${DOCKER_REPO-renovate/cache-test}
DOCKER_TAG=${DOCKER_TAG-slim}

# Strip git ref prefix from version
VERSION=${REF#refs/tags/}

SEMVER_REGEX="^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)?$"

if ! [[ "$VERSION" =~ $SEMVER_REGEX ]]; then
  echo Not a semver tag - skipping: ${REF#refs/tags/}
  exit 1
fi

major=${BASH_REMATCH[1]}
minor=${BASH_REMATCH[2]}
patch=${BASH_REMATCH[3]}
slim=${DOCKER_TAG#latest}
slim=${slim:+-}${slim}

ARGS=(--platform=${PLATFORM} --cache-from=${DOCKER_REPO}:cache-${DOCKER_TAG} --push --tag=${DOCKER_REPO}:${DOCKER_TAG})

# Tag for versions additional
for tag in {"${major}${slim}","${major}.${minor}${slim}","${major}.${minor}.${patch}${slim}"}; do
  ARGS+=(--tag ${DOCKER_REPO}:${tag})
done

ARGS+=(--file=./${DOCKER_FILE} .)

set -x
docker buildx build "${ARGS[@]}"
