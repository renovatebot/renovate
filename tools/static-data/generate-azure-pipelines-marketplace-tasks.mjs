import got from 'got';
import { updateJsonFile } from './utils.mjs';

const dataUrl =
  'https://raw.githubusercontent.com/renovatebot/azure-devops-marketplace/main/azure-pipelines-marketplace-tasks.json';

await (async () => {
  console.log('Generating azure pipelines marketplace tasks');
  const { body } = await got(dataUrl);
  await updateJsonFile('./data/azure-pipelines-marketplace-tasks.json', body);
})();
