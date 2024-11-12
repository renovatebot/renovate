import got from 'got';
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
  const { body } = await got(lambdaDataUrl);

  /**
   * @type Array<RuntimeDefinition>
   */
  const lambdas = JSON.parse(body);
  const nodeRuntimes = lambdas
    // Filter Runtimes down to only NodeJS Runtimes
    .filter((lambda) => lambda.cycle.startsWith('nodejs'))
    // The only Runtime where support is not either `true` or a Date as a string is `0.10.x`, which we don't need
    .filter((lambda) => lambda.support !== false)
    .reduce((schedule, lambda) => {
      const versionMatch = lambda.cycle.match(/^nodejs([0-9]+)\.x$/);

      if (!versionMatch?.[1]) {
        return schedule;
      }

      return {
        ...schedule,
        [versionMatch[1]]: lambda,
      };
    }, {});

  await updateJsonFile(
    './data/lambda-node-js-schedule.json',
    JSON.stringify(nodeRuntimes),
  );
})();
