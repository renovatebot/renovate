#!/bin/bash

set -euo pipefail

# This script should be called by GitHub Action

function install_gettext {
    sudo apt install -y gettext
}

function commit {
    git config --global user.name  'Renovate Bot'
    git config --global user.email 'renovate@whitesourcesoftware.com'

    git add i18n/sources.txt i18n/messages.pot
    git commit -m "chore(i18n): daily update the POT file"
}

function make_pr {
    local changeLines
    changeLines=$(git diff --shortstat i18n/messages.pot | awk '{ print $4 }')

    if [ "$changeLines" -gt 1 ]; then
        commit
    else
        git checkout .
        echo 'The POT file have not changed. Goodbye.'
    fi
}

function main {
    install_gettext
    make i18n/sources.txt
    make i18n/messages.pot

    make_pr
}

main
