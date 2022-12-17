import got from 'got';
import shell from 'shelljs';
import { updateJsonFile } from './utils.mjs';

const dataUrl =
  'https://raw.githubusercontent.com/nodejs/LTS/HEAD/schedule.json';

await (async () => {
  shell.echo('Generating node schedule');
  const { body } = await got(dataUrl);
  await updateJsonFile('./data/node-js-schedule.json', body);
})();
