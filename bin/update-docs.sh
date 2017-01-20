#!/usr/bin/env bash

perl -0777 -i -pe 's/\n  Usage:.*package-test\n/`node renovate --help`/se' readme.md
perl -0777 -i -pe 's/\n  Usage:.*package-test\n/`node renovate --help`/se' docs/configuration.md
perl -0777 -i -pe 's/## Configuration Options.*/`node renovate --print-table`/se' docs/configuration.md
