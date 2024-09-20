#!/bin/bash

if [[ -f "/usr/local/etc/env" && -z "${CONTAINERBASE_ENV+x}" ]]; then
    # shellcheck source=/dev/null
  . /usr/local/etc/env
fi

if [[ "${1:0:1}" = '-' ]]; then
  # assume $1 is renovate flag
  set -- renovate "$@"
fi

if [[ ! -x "$(command -v "${1}")" ]]; then
  # assume $1 is a repo
  set -- renovate "$@"
fi

exec dumb-init -- "$@"
