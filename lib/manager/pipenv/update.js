toml = require('toml')
tomlify = require('tomlify-j0.4')

module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  try {
    logger.debug(`pipenv.updateDependency(): ${upgrade.newValue}`);
    const pipfile = toml.parse(fileContent);
    pipfile.packages[upgrade.depName] = upgrade.newValue;
    return tomlify.toToml(pipfile)
  } catch (err) {
    logger.info({ err }, 'Error setting new package version');
    return null;
  }
}

