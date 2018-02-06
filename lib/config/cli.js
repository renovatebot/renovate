const commander = require('commander');
const configDefinitions = require('./definitions');
const { version } = require('../../package.json');

module.exports = {
  getCliName,
  getConfig,
};

function getCliName(option) {
  if (option.cli === false) {
    return '';
  }
  const nameWithHyphens = option.name.replace(/([A-Z])/g, '-$1');
  return `--${nameWithHyphens.toLowerCase()}`;
}

function getConfig(argv) {
  const options = configDefinitions.getOptions();

  const config = {};

  const coersions = {
    boolean: val => val === 'true',
    list: val => val.split(',').map(el => el.trim()),
    string: val => val,
  };

  let program = new commander.Command().arguments('[repositories...]');

  options.forEach(option => {
    if (option.cli !== false) {
      const param = `<${option.type}>`.replace('<boolean>', '[boolean]');
      const optionString = `${getCliName(option)} ${param}`;
      program = program.option(
        optionString,
        option.description,
        coersions[option.type]
      );
    }
  });

  /* istanbul ignore next */
  function helpConsole() {
    /* eslint-disable no-console */
    console.log('  Examples:');
    console.log('');
    console.log('    $ renovate --token abc123 singapore/lint-condo');
    console.log(
      '    $ renovate --labels=renovate,dependency --ignore-unstable=false --log-level verbose singapore/lint-condo'
    );
    console.log('    $ renovate singapore/lint-condo singapore/package-test');
    /* eslint-enable no-console */
  }

  program = program
    .version(version, '-v, --version')
    .on('--help', helpConsole)
    .action(repositories => {
      config.repositories = repositories;
    })
    .parse(argv);

  options.forEach(option => {
    if (option.cli !== false) {
      if (program[option.name] !== undefined) {
        config[option.name] = program[option.name];
      }
    }
  });

  return config;
}
