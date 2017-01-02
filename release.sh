#!/usr/bin/env bash

set -e # exit when error

if [[ -n $(npm owner add `npm whoami`) ]]; then
  printf "Release: Not an owner of the npm repo, ask for it\n"
  exit 1
fi

currentBranch=`git rev-parse --abbrev-ref HEAD`
if [ $currentBranch != 'master' ]; then
  printf "Release: You must be on master\n"
  exit 1
fi

if [[ -n $(git status --porcelain) ]]; then
  printf "Release: Working tree is not clean (git status)\n"
  exit 1
fi

if [[ $# -eq 0 ]] ; then
  printf "Release: use ``yarn release [major|minor|patch|x.x.x]``\n"
  exit 1
fi

mversion $1
git commit -am "$(json -f package.json version)"
git tag v`json -f package.json version`
git push
git push --tags
npm publish
