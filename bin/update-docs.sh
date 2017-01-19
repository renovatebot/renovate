#!/usr/bin/env bash

perl -0777 -i -pe 's/\n  Usage:.*package-test\n/`node renovate --help`/se' readme.md
perl -0777 -i -pe 's/\n  Usage:.*package-test\n/`node renovate --help`/se' docs/configuration.md
