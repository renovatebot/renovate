YARN_VERSION_REQUIRED=$(grep '"yarn"' package.json | sed 's/    "yarn": "//' | sed 's/"//')
curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version $YARN_VERSION_REQUIRED
