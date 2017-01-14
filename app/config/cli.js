const logger = require('winston');
const program = require('commander');

const config = {};

program
  .arguments('[repository] [fileName]')
  .option('--dep-types <types>', 'List of dependency types')
  .option('--force', 'Force creation of PRs')
  .option('--ignore-deps <list>', 'List of dependencies to ignore')
  .option('--labels <labels>', 'List of labels to apply')
  .option('--log-level <level>', 'Log Level')
  .option('--token <token>', 'GitHub Auth Token')
  .on('--help', () => {
    /* eslint-disable no-console */
    console.log('  Examples:');
    console.log('');
    console.log('    $ renovate --token sp2jb5h7nsfjsg9s60v23b singapore/lint-condo');
    console.log('    $ renovate --token sp2jb5h7nsfjsg9s60v23b singapore/lint-condo custom/location/package.json');
    console.log('');
    /* eslint-enable no-console */
  })
  .action((repository, fileName) => {
    config.repositories = [
      {
        repository,
        packageFiles: [fileName || 'package.json'],
      },
    ];
  })
  .parse(process.argv);

if (program.depTypes) {
  config.depTypes = program.depTypes.split(',');
}
if (program.force) {
  config.force = true;
}
if (program.ignoreDeps) {
  config.ignoreDeps = program.ignoreDeps.split(',');
}
if (program.labels) {
  config.labels = program.labels.split(',');
}
if (program.logLevel) {
  config.logLevel = program.logLevel;
}
if (program.token) {
  config.token = program.token;
}

logger.debug(`CLI config: ${JSON.stringify(config)}`);

module.exports = config;
