import { z } from 'zod/v4';
import { Json } from '../../../lib/util/schema-utils/index.ts';
import type { StaticDataSource } from '../types.ts';
import { describeKeys, fetchText } from '../utils.ts';

const NodeSchedule = z.record(z.string(), z.unknown());
type NodeSchedule = z.infer<typeof NodeSchedule>;

export const nodeSchedule: StaticDataSource<NodeSchedule, NodeSchedule> = {
  name: 'node-schedule',
  file: 'lib/data/node-js-schedule.json',
  fetch: async () =>
    Json.pipe(NodeSchedule).parse(
      await fetchText(
        'https://raw.githubusercontent.com/nodejs/LTS/HEAD/schedule.json',
      ),
    ),
  generate: (schedule) => schedule,
  commitMessage: (before, after) =>
    describeKeys(before ?? {}, after, (added) =>
      added.length > 0
        ? `add Node.js ${added.join(', ')} to the release schedule`
        : 'update Node.js release schedule',
    ),
};
