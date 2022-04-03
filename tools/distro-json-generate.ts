import fs from 'fs-extra';
import got from 'got';
import shell from 'shelljs';

const url = 'https://debian.pages.debian.net/distro-info-data/ubuntu.csv';

/**
 * @param {string} raw
 * @returns {string}
 */
function csvToJson(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const res: { [index: string]: any } = {};
  const headers = lines[0].split(',');

  // drop headers
  lines.shift();

  // drop "version" header
  headers.shift();

  for (const l of lines) {
    if (!l) {
      continue;
    }

    const obj: { [index: string]: any } = {};
    const line = l.split(',');
    const ver = line?.shift()?.replace(/LTS|\s/g, '');

    for (const [i, h] of headers.entries()) {
      obj[h.replace('-', '_')] = line[i];
    }

    if (ver) {
      res[ver] = obj;
    }
  }
  return JSON.stringify(res);
}

/**
 * @param {string} file
 * @param {string} newData
 */
async function updateJsonFile(file: string, newData: string): Promise<void> {
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

  const oldLen = oldData?.length ?? 0;
  const newLen = newData?.length ?? 0;

  if (oldLen === 0 || newLen === 0 || oldLen > newLen) {
    shell.echo(`New data might be corrupted!`);
    shell.echo(`Aborting ${file} update`);
    shell.echo(
      `**************** NEW DATA ****************\n${
        JSON.stringify(newData) || newData
      } `
    );
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

/**
 * @param {string} url
 */
async function update(url: string): Promise<void> {
  const res = await got(url);
  const csv = res.body;
  const json = csvToJson(csv);
  await updateJsonFile(`./data/ubuntu-distro-info.json`, json);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
update(url);
