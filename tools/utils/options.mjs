import { Command } from 'commander';

const program = new Command();
program
  .version('0.0.1')
  .requiredOption('-r, --release <type>', 'Version to use')
  .option('-s, --sha <type>', 'Git sha to use')
  .option('-t, --tag <type>', 'Npm dist-tag to publish to')
  .option('-d, --dry-run');

program.parse(process.argv);

export const options = program.opts();

export { program };
