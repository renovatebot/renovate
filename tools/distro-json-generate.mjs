import https from 'https';
import fs from 'fs-extra';
import shell from 'shelljs';

let url = 'https://debian.pages.debian.net/distro-info-data/ubuntu.csv';

/**
 * @param {string} url
 * @param {function} cb
 */
function csv(url, cb) {
  https.get(url, (response) => {
    let buffer = '';
    response
      .on('data', (d) => {
        buffer += d.toString();
      })
      .on('end', () => {
        cb(buffer);
      })
      .on('error', (e) => {
        shell.echo(
          `csv - Error fetching distro data from URL:${url} e: ${e}\n Exiting...`
        );
        shell.exit(2);
      })
      .setEncoding('utf8');
  });
}

/**
 * @param {string} raw
 * @returns {string}
 */
function csvToJson(raw) {
  const lines = raw.split(/\r?\n/);
  const res = {};
  const headers = lines[0].split(',');

  // drop headers
  lines.shift();

  // drop "version" header
  headers.shift();

  lines
    // drop empty lines
    .filter((l) => !!l)
    .map((l) => {
      const obj = {};
      const line = l.split(',');
      // eslint-disable-next-line
      // @ts-ignore
      const ver = line.shift().replace(/LTS|\s/g, '');

      headers.map((h, i) => {
        // eslint-disable-next-line
        // @ts-ignore
        obj[h.replace('-', '_')] = line[i];
      });

      // eslint-disable-next-line
      // @ts-ignore
      res[ver] = obj;
    });
  return JSON.stringify(res);
}

/**
 * @param {string} file
 * @param {string} newData
 */
async function updateJsonFile(file, newData) {
  let oldData;

  try {
    oldData = fs.existsSync(file) ? await fs.readFile(file, 'utf8') : null;
    // Eliminate formatting. removes WS in the beginning, end. before & after non characters
    oldData = oldData?.replace(/^\s|\s$|\B\s|\s\B/g, '') ?? null;
  } catch (e) {
    shell.echo(e.toString());
    shell.exit(1);
  }

  if (oldData === newData) {
    shell.echo(`${file} is up to date.`);
    return;
  }

  try {
    shell.echo(`Updating ${file}`);
    await fs.writeFile(file, newData);
  } catch (e) {
    shell.echo(e.toString());
    shell.exit(1);
  }
}

csv(
  url,
  /**
   * @param {string} raw
   */
  (raw) => {
    let json = csvToJson(raw);
    //shell.echo(json);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    updateJsonFile(`../data/ubuntu-distro-info.json`, json);
  }
);
