const commander = require('commander');
const configMaster = require('./master');

module.exports = {
  getCliName,
  getConfig,
};

function getCliName(option) {
  const nameWithHyphens = option.name.replace(/([A-Z])/g, '-$1');
  return `--${nameWithHyphens.toLowerCase()}`;
}

function getConfig() {
  const options = configMaster.getOptions();

  const config = {};

  const coersions = {
    boolean: val => (val === 'true'),
    list: val => val.split(',').map(el => el.trim()),
    string: val => val,
  };

  let program = commander.arguments('[repositories...]');

  options.forEach((option) => {
    if (option.cli !== false) {
      const param = `<${option.type}>`.replace('<boolean>', '[boolean]');
      const optionString = `${getCliName(option)} ${param}`;
      program = program.option(optionString, option.description, coersions[option.type]);
    }
  });

  program = program
    .on('--help', () => {
      /* eslint-disable no-console */
      console.log('  Examples:');
      console.log('');
      console.log('    $ renovate --token abc123 singapore/lint-condo');
      console.log('    $ renovate --ignore-unstable=false --log-level verbose singapore/lint-condo');
      console.log('    $ renovate singapore/lint-condo singapore/package-test');
      console.log('');
      /* eslint-enable no-console */
    })
    .action((repositories) => {
      config.repositories = repositories;
    })
    .parse(process.argv);

  options.forEach((option) => {
    if (option.cli !== false) {
      if (program[option.name]) {
        config[option.name] = program[option.name];
      }
    }
  });

  return config;
}
