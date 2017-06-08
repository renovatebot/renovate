YARN_VERSION=$(grep yarn package.json | sed 's/   "yarn": "//' | sed 's/"//')
if [[ ! -e ~/.yarn/bin/yarn || $(yarn --version) != "${YARN_VERSION}" ]]; then
  echo "Installing Yarn $YARN_VERSION"
  rm -rf ~/.yarn
  curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version $YARN_VERSION
fi
