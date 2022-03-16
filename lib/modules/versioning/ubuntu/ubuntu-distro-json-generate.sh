#!/bin/sh

## ubuntu-distro-info requires installing "distro-info"
ubuntu-distro-info --all -f | sed -r 's/Ubuntu|"|LTS //g; s/([0-9]+.[0-9]+) /\1=/; s/.*/\L&/; s/(=[a-z]*) [a-z]*/\1/g; s/^[ \t]*//' | jo
