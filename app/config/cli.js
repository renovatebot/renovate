const logger = require('winston');
const program = require('commander');

const config = {};

program
  .arguments('[repositories...]')
  .option('--dep-types <list>', 'List of dependency types', list)
  .option('--force', 'Force creation of PRs')
  .option('--ignore-deps <list>', 'List of dependencies to ignore', list)
  .option('--labels <list>', 'List of labels to apply', list)
  .option('--log-level <level>', 'Log Level')
  .option('--package-files <list>', 'List of package.json file names', list)
  .option('--token <token>', 'GitHub Auth Token')
  .on('--help', () => {
    /* eslint-disable no-console */
    console.log('  Examples:');
    console.log('');
    console.log('    $ renovate --token abc123 singapore/lint-condo');
    console.log('    $ renovate --token abc123 singapore/lint-condo singapore/package-test');
    console.log('');
    /* eslint-enable no-console */
  })
  .action((repositories) => {
    config.repositories = repositories;
  })
  .parse(process.argv);

if (program.depTypes) {
  config.depTypes = program.depTypes;
}
if (program.force) {
  config.force = true;
}
if (program.ignoreDeps) {
  config.ignoreDeps = program.ignoreDeps;
}
if (program.labels) {
  config.labels = program.labels;
}
if (program.logLevel) {
  config.logLevel = program.logLevel;
}
if (program.packageFiles) {
  if (config.repositories) {
    // We can't use package files if we don't have repositories
    config.repositories = config.repositories.map(repository => ({
      repository,
      packageFiles: program.packageFiles,
    }));
  } else {
    logger.error('Defining package files via CLI requires at least one repository too');
    program.outputHelp();
    process.exit(1);
  }
}
if (program.token) {
  config.token = program.token;
}

logger.debug(`CLI config: ${JSON.stringify(config)}`);

module.exports = config;

function list(val) {
  return val.split(',');
}
