import fs from 'fs-extra';
import shell from 'shelljs';

/**
 * Update given file with new provided data.
 * @param {string} file Path to a data file
 * @param {string} newData New data to be written
 */
export async function updateJsonFile(file, newData) {
  try {
    shell.echo(`Updating ${file}`);
    await fs.writeFile(file, newData);
  } catch (e) {
    shell.echo(e.toString());
    shell.exit(1);
  }
}
