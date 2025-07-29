import { z } from 'zod';
import { updateJsonFile } from './utils.mjs';

const RuntimesSchema = z.object({
  cycle: z.string().describe('The ID of the Runtime'),
  support: z
    .union([z.boolean(), z.string()])
    .describe(
      'Either `true` if in support, or a string denoting when support for this Runtime will end. 0.10.x is a sole exception which has a value of `false` and will be filtered out',
    ),
});
const RuntimesArraySchema = z.array(RuntimesSchema);

const lambdaDataUrl = 'https://endoflife.date/api/aws-lambda.json';

await (async () => {
  console.log('Generating node schedule');

  const lambdas = await fetch(lambdaDataUrl).then(async (response) => {
    if (!response.ok) {
      console.error(`Failed to fetch ${lambdaDataUrl}`, response);
      process.exit(1);
    }

    return RuntimesArraySchema.parseAsync(await response.json());
  });

  /** @type {Record<string, z.infer<RuntimesSchema>>} */
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
