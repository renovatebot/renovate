import { updateJsonFile } from './utils.mjs';

/**
 * @typedef RuntimeDefinition
 * @type {object}
 * @property {string} cycle - The ID of the Runtime.
 * @property {boolean|string} support - Either `true` if in support or a string denoting when support for this Runtime
 *                                      will end. 0.10.x is a sole exception which has `false` and will be filtered out.
 */

const lambdaDataUrl = 'https://endoflife.date/api/aws-lambda.json';

await (async () => {
  console.log('Generating node schedule');

  /**
   * @type Array<RuntimeDefinition>
   */
  const lambdas = await fetch(lambdaDataUrl).then((response) => {
    if (!response.ok) {
      console.error(`Failed to fetch ${lambdaDataUrl}`, response);
      process.exit(1);
    }

    return response.json();
  });

  /**
   * @type {{ [version: string]: RuntimeDefinition }}
   */
  const nodeRuntimes = {};

  for (let lambda of lambdas) {
    if (!lambda.cycle.startsWith('nodejs')) {
      continue;
    }

    if (lambda.support === false) {
      continue;
    }

    const versionMatch = /^nodejs([0-9]+)\.x$/.exec(lambda.cycle);

    if (!versionMatch?.[1]) {
      continue;
    }

    nodeRuntimes[versionMatch[1]] = lambda;
  }

  await updateJsonFile(
    './data/lambda-node-js-schedule.json',
    JSON.stringify(nodeRuntimes, null, 2),
  );
})();
