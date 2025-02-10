#!/bin/bash

if [[ "${1:0:1}" = '-' ]]; then
  # assume $1 is renovate flag
  set -- renovate "$@"
fi

if [[ ! -x "$(command -v "${1}")" ]]; then
  # assume $1 is a repo
  set -- renovate "$@"
fi

# call the original entrypoint
exec docker-entrypoint.sh "$@"
