import fs from 'fs-extra';
import shell from 'shelljs';

shell.echo(`Verifying required packages...`);

if (!shell.which(`distro-info`)) {
  shell.echo('This script requires distro-info, exiting...');
  shell.exit(2);
}

if (!shell.which(`sed`)) {
  shell.echo('This script requires sed, exiting...');
  shell.exit(2);
}

if (!shell.which(`jo`)) {
  shell.echo('This script requires jo, exiting...');
  shell.exit(2);
}

shell.echo(`OK`);

const ubuntuDistroInfo = shell.exec(
  `ubuntu-distro-info --all -f | sed -r 's/Ubuntu|"|LTS //g; s/([0-9]+.[0-9]+) /\\1=/; s/.*/\\L&/; s/(=[a-z]*) [a-z]*/\\1/g; s/^[ \\t]*//' | jo`,
  { silent: true }
);

/**
 *
 * @param {string} file
 * @param {string} newJsonData
 */
async function updateJsonFile(file, newJsonData) {
  let oldJson = fs.existsSync(file) ? await fs.readFile(file, 'utf8') : null;

  // Eliminate formatting
  oldJson = oldJson?.replace(/[\s\r?\n]/g, '') ?? null;
  newJsonData = newJsonData.replace(/[\s\r?\n]/g, '');

  if (oldJson === newJsonData) {
    shell.echo('ubuntu-distro-info.json is up to date.');
    return;
  }

  shell.echo('Updating ubuntu-distro-info.json');
  await fs.writeFile(file, newJsonData);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    await updateJsonFile(
      `../data/ubuntu-distro-info.json`,
      ubuntuDistroInfo.toString()
    );
  } catch (e) {
    shell.echo(e.toString());
    shell.exit(1);
  }
})();
