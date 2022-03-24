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

shell.echo(`OK`);

const ubuntuDistroInfo = shell.exec(
  `ubuntu-distro-info --all -f | sed -r 's/Ubuntu|"|LTS |Debian //g; s/([0-9]+.[0-9]+) /\\1 /; s/.*/\\L&/; s/( [a-z]*) [a-z]*/\\1/g; s/^[ \\t]*//'`,
  { silent: true }
);

/**
 * @param {string} str
 * @returns {{}}
 */
function objectify(str) {
  let obj = {};

  for (const line of str.split(/\r?\n/)) {
    let [ver, codename] = line.split(' ');
    // eslint-disable-next-line
    // @ts-ignore
    obj[ver] = codename;
  }

  return obj;
}

/**
 * @param {string} file
 * @param {string} newData
 */
async function updateJsonFile(file, newData) {
  let oldData;

  try {
    oldData = fs.existsSync(file) ? await fs.readFile(file, 'utf8') : null;
    // Eliminate formatting
    oldData = oldData?.replace(/\s/g, '') ?? null;
  } catch (e) {
    shell.echo(e.toString());
    shell.exit(1);
  }

  const parsedData = JSON.stringify(objectify(newData), undefined, 2);

  if (oldData === parsedData) {
    shell.echo(`${file} is up to date.`);
    return;
  }

  try {
    shell.echo(`Updating ${file}`);
    await fs.writeFile(file, parsedData);
  } catch (e) {
    shell.echo(e.toString());
    shell.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
updateJsonFile(`../data/ubuntu-distro-info.json`, ubuntuDistroInfo.toString());
