#!/bin/bash

echo "1"

set -e

echo "2"

if [[ "${CODESPACES}" == true ]]; then
  echo "3"

  echo "Fixing permissions of /tmp for GitHub Codespaces..." >&2

  echo "4"

  sudo chmod 1777 /tmp

  echo "5"
fi

echo "6"

set -x

echo "7"

exec yarn install

echo "8"
