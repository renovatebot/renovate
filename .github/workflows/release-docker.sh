#!/bin/bash
set -e

DOCKER_REPO=${DOCKER_REPO-renovate/cache-test}

VERSION=${1}
GIT_HASH=${2}

SEMVER_REGEX="^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)?$"

if ! [[ "$VERSION" =~ $SEMVER_REGEX ]]; then
  echo Not a semver tag - skipping: ${VERSION}
  exit 1
fi

# build final images
docker buildx bake \
  --file docker/bake.hcl \
  --set settings.labels.org.opencontainers.image.version=${VERSION} \
  --set settings.labels.org.opencontainers.image.revision=${GIT_HASH} \
  --set settings.output=type=docker \
  default

major=${BASH_REMATCH[1]}
minor=${BASH_REMATCH[2]}
patch=${BASH_REMATCH[3]}

docker push ${DOCKER_REPO}:latest
docker push ${DOCKER_REPO}:slim


# Tag for versions additional
for tag in {"${major}","${major}.${minor}","${major}.${minor}.${patch}"}; do
  echo "Tagging ${DOCKER_REPO}:$tag"
  docker tag ${DOCKER_REPO}:latest ${DOCKER_REPO}:${tag}
  docker push ${DOCKER_REPO}:${tag}
  docker tag ${DOCKER_REPO}:slim ${DOCKER_REPO}:${tag}-slim
  docker push ${DOCKER_REPO}:${tag}-slim
done

