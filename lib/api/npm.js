const got = require('got');

module.exports = {
  getDependency,
};

function getDependency(depName) {
  // supports scoped packages, e.g. @user/package
  return got(`https://registry.npmjs.org/${depName.replace('/', '%2F')}`, {
    json: true,
  }).then(res => res.body);
}
