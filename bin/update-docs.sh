#!/usr/bin/env bash

perl -0777 -i -pe 's/\n  Usage:.*package-test\n/`node dist\/renovate --help`/se' docs/configuration.md
perl -0777 -i -pe 's/## Configuration Options.*//se' docs/configuration.md
node bin/update-configuration-table.js >> docs/configuration.md
