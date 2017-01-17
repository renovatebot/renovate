const got = require('got');

module.exports = {
  getDependencyVersions,
};

function getDependencyVersions(depName) {
  // supports scoped packages, e.g. @user/package
  return got(`https://registry.npmjs.org/${depName.replace('/', '%2F')}`, {
    json: true,
  }).then(res => res.body.versions);
}
