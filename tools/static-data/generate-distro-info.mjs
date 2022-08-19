import got from 'got';
import shell from 'shelljs';
import { updateJsonFile } from './utils.mjs';

const ubuntuUrl = 'https://debian.pages.debian.net/distro-info-data/ubuntu.csv';
const debianUrl = 'https://debian.pages.debian.net/distro-info-data/debian.csv';

/**
 * Converts valid CSV string into JSON.
 * @param {string} raw CSV string
 * @returns {string} JSON representation of input CSV
 */
function csvToJson(raw) {
  const lines = raw.split(/\r?\n/);

  /** @type {Record<string, any>} */
  const res = {};
  const headers = lines[0].split(',');

  // drop headers
  lines.shift();

  // drop "version" header
  headers.shift();

  for (const l of lines) {
    if (!l) {
      continue;
    }

    /** @type {Record<string, any>} */
    const obj = {};
    const line = l.split(',');
    let ver = line?.shift()?.replace(/LTS|\s/g, '');

    for (const [i, h] of headers.entries()) {
      obj[h.replace('-', '_')] = line[i];
    }

    if (ver) {
      // Debian related, example codename "hamm" version is 2.0
      // change 2.0 -> 2
      ver = ver.endsWith('.0') ? ver.replace('.0', '') : ver;
      res[`v${ver}`] = obj;
    }
  }
  return JSON.stringify(res, undefined, 2);
}

/**
 * Fetch CSV and update data file.
 * @param {string} url Url to CSV
 * @param {string} file File path to update
 */
async function update(url, file) {
  const res = await got(url);
  const csv = res.body;
  const json = csvToJson(csv);
  await updateJsonFile(file, json);
}

await (async () => {
  shell.echo('Generating distro info');
  await update(ubuntuUrl, `./data/ubuntu-distro-info.json`);
  await update(debianUrl, `./data/debian-distro-info.json`);
})();
