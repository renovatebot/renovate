YARN_VERSION_INSTALLED=$(yarn --version)
YARN_VERSION_REQUIRED=$(grep yarn package.json | sed 's/    "yarn": "//' | sed 's/"//')
if [[ "$YARN_VERSION_INSTALLED" != "$YARN_VERSION_REQUIRED" ]]; then
  echo "Installing Yarn $YARN_VERSION_REQUIRED"
  rm -rf ~/.yarn
  curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version $YARN_VERSION_REQUIRED
fi
