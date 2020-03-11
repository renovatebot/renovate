import commander from 'commander';

const program = new commander.Command();
program
  .version('0.0.1')
  .requiredOption('-r, --release <type>', 'Version to use')
  .option('-s, --sha <type>', 'Sha to use')
  .option('-d, --dry-run');

program.parse(process.argv);

export default program;
