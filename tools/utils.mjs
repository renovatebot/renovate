import commander from 'commander';
import shell from 'shelljs';

const program = new commander.Command();
program
  .version('0.0.1')
  .requiredOption('-r, --release <type>', 'Version to use')
  .option('-s, --sha <type>', 'Git sha to use')
  .option('-t, --tag <type>', 'Npm dist-tag to publish to')
  .option('-d, --dry-run');

program.parse(process.argv);

export const options = program.opts();

export { program };

/**
 * Executes a shell command
 * @param cmd {string} The command to execute
 * @returns {boolean} Returns true on zero exit code otherwise false
 */
export function exec(cmd) {
  try {
    if (!program.dryRun) {
      const res = shell.exec(cmd);
      return res.code === 0;
    }
    shell.echo(`DRY-RUN: ${cmd}`);
  } catch (e) {
    shell.echo(e.toString());
    return false;
  }
  return true;
}
