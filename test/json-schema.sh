#!/bin/bash

yarn create-json-schema

CHANGED=$(git status --porcelain | grep renovate-schema.json | wc -l)

if [ "$CHANGED" -eq 0 ]; then
    echo "PASS: renovate-schema.json is up to date"
    exit 0
else
    git diff renovate-schema.json
    echo "ERROR: renovate-schema.json needs updating. Run 'yarn create-json-schema' and commit."
    exit -1
fi
