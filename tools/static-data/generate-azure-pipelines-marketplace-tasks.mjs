import got from 'got';
import shell from 'shelljs';
import { updateJsonFile } from './utils.mjs';

const dataUrl =
  'https://raw.githubusercontent.com/renovatebot/azure-devops-marketplace/main/azure-pipelines-marketplace-tasks.json';

await (async () => {
  shell.echo('Generating azure pipelines marketplace tasks');
  const { body } = await got(dataUrl);
  await updateJsonFile('./data/azure-pipelines-marketplace-tasks.json', body);
})();
