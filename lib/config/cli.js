const logger = require('winston');
const program = require('commander');

const config = {};

program
  .arguments('[repositories...]')
  .option('-t, --token <token>', 'GitHub Auth Token')
  .option('-p, --package-files <list>', 'List of package.json file names', list)
  .option('-d, --dep-types <list>', 'List of dependency types', list)
  .option('-i, --ignore-deps <list>', 'List of dependencies to ignore', list)
  .option('-b, --labels <list>', 'List of labels to apply', list)
  .option('-r, --ignore-future [true/false]', 'Ignore versions tagged as "future"', bool)
  .option('-r, --ignore-unstable [true/false]', 'Ignore versions with unstable semver')
  .option('-r, --respect-latest [true/false]', 'Ignore versions newer than dependency\'s "latest"')
  .option('-r, --recreate-closed [true/false]', 'Recreate PR even if same was previously closed')
  .option('-r, --recreate-unmergeable [true/false]', 'Recreate PR if existing branch is unmergeable')
  .option('-l, --log-level <level>', 'Log Level')
  .on('--help', () => {
    /* eslint-disable no-console */
    console.log('  Examples:');
    console.log('');
    console.log('    $ renovate --token abc123 singapore/lint-condo');
    console.log('    $ renovate --ignore-unstable=false -l verbose singapore/lint-condo');
    console.log('    $ renovate singapore/lint-condo singapore/package-test');
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
  config.packageFiles = program.packageFiles;
}
if (program.ignoreFuture) {
  config.ignoreFuture = program.ignoreFuture;
}
if (program.ignoreUnstable) {
  config.ignoreUnstable = program.ignoreUnstable;
}
if (program.respectLatest) {
  config.respectLatest = program.respectLatest;
}
if (program.recreateClosed) {
  config.recreateClosed = program.recreateClosed;
}
if (program.recreateUnmergeable) {
  config.recreateUnmergeable = program.recreateUnmergeable;
}
if (program.token) {
  config.token = program.token;
}

logger.debug(`CLI config: ${JSON.stringify(config)}`);

module.exports = config;

function list(val) {
  return val.split(',');
}

function bool(val) {
  if (val === 'true') {
    return true;
  } else if (val === 'false') {
    return false;
  }
  logger.error(`Boolean option must be true or false (is: "${val}")`);
  return process.exit(1);
}
