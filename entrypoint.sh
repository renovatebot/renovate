#!/bin/sh

set -x

# TODO: preprocess environment variables to setup a workable configuration
# TODO: any other preprocessing?

# execute the main command passing on the parameters
exec "renovate" "$@"
