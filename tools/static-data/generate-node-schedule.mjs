import { updateJsonFile } from './utils.mjs';

const dataUrl =
  'https://raw.githubusercontent.com/nodejs/LTS/HEAD/schedule.json';

await (async () => {
  console.log('Generating node schedule');
  const res = await fetch(dataUrl);
  if (!res.ok) {
    console.error(`Failed to fetch ${dataUrl}`, res);
    process.exit(1);
  }
  await updateJsonFile('./lib/data/node-js-schedule.json', await res.text());
})();
