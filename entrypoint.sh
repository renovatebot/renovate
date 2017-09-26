#!/bin/sh

set -x

# TODO: preprocess environment variables to setup a workable configuration
# TODO: ...

# execute the main command
exec "renovate $@"
