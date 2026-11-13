import { z } from 'zod/v4';
import { Json } from '../../../lib/util/schema-utils/index.ts';
import type { StaticDataSource } from '../types.ts';
import { describeKeys, fetchText } from '../utils.ts';

const Runtime = z.object({
  cycle: z.string().describe('The ID of the Runtime'),
  support: z
    .union([z.boolean(), z.string()])
    .describe(
      'Either `true` if in support, or a string denoting when support for this Runtime will end. 0.10.x is a sole exception which has a value of `false` and will be filtered out',
    ),
});
type Runtime = z.infer<typeof Runtime>;

export const lambdaNodeSchedule: StaticDataSource<
  Runtime[],
  Record<string, Runtime>
> = {
  name: 'lambda-node-schedule',
  file: 'data/lambda-node-js-schedule.json',
  fetch: async () =>
    Json.pipe(z.array(Runtime)).parse(
      await fetchText('https://endoflife.date/api/aws-lambda.json'),
    ),
  generate: (runtimes) => {
    const nodeRuntimes: Record<string, Runtime> = {};
    for (const runtime of runtimes) {
      if (runtime.support === false) {
        continue;
      }

      const version = /^nodejs(?<version>[0-9]+)\.x$/.exec(runtime.cycle)
        ?.groups?.version;
      if (version) {
        nodeRuntimes[version] = runtime;
      }
    }
    return nodeRuntimes;
  },
  commitMessage: (before, after) =>
    describeKeys(before ?? {}, after, (added) =>
      added.length > 0
        ? `add AWS Lambda Node.js ${added.join(', ')}`
        : 'update AWS Lambda Node.js schedule',
    ),
};
