import commander from 'commander';
import core from '@actions/core';
import shell from 'shelljs';

const program = new commander.Command();
program
  .version('0.0.1')
  .requiredOption('-r, --release <type>', 'Version to use')
  .option('-s, --sha <type>', 'Sha to use')
  .option('-d, --dry-run');

program.parse(process.argv);

export { program };

/**
 * Executes a shell command
 * @param cmd {string} The command to execute
 * @returns {boolean} Returns true on zero exit code otherwise false
 */
export function exec(cmd, ignores = []) {
  try {
    if (program.dryRun) {
      core.warning(`DRY-RUN: ${cmd}`);
      return true;
    }

    core.startGroup(cmd);
    const res = shell.exec(cmd);
    if (res.code === 0) {
      return true;
    }

    if (
      ignores.length &&
      ignores.some(s => res.stdout.includes(s) || res.stderr.includes(s))
    ) {
      core.warning(`Ignoring code: ${res.code}`);
      return true;
    }

    core.warning(`Failed with code: ${res.code}`);
    return false;
  } catch (e) {
    core.error(e.toString());
    return false;
  } finally {
    core.endGroup(cmd);
  }
}
