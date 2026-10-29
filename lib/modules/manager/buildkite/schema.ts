import { z } from 'zod/v4';
import { LooseArray, LooseRecord } from '../../../util/schema-utils/index.ts';

function imageFromAgentsList(entries: string[]): string | undefined {
  for (const entry of entries) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = entry.slice(0, separatorIndex);
    if (key === 'image') {
      return entry.slice(separatorIndex + 1);
    }
  }
  return undefined;
}

// `agents` targets specific agents, either as a map of tag key/value pairs or
// as an array of `key=value` strings. Neither shape is Docker-image-specific,
// but some orgs (e.g. Elastic) use a literal `image` tag to point their agent
// provisioning at a Docker image.
const BuildkiteAgentsImage = z
  .union([LooseRecord(z.string()), LooseArray(z.string())])
  .transform((agents) =>
    Array.isArray(agents) ? imageFromAgentsList(agents) : agents.image,
  )
  .catch(undefined);

const BaseImages = z.object({
  image: z.string().optional().catch(undefined),
  agents: BuildkiteAgentsImage.optional(),
});

export interface BuildkiteStep {
  image: string | undefined;
  agentsImage: string | undefined;
  steps: BuildkiteStep[];
}

// `steps` can nest further `steps` via group steps, so this schema is
// self-referential, same approach as `CircleCiOrb` in ../circleci/schema.ts.
export const BuildkiteStep: z.ZodType<BuildkiteStep> = BaseImages.extend({
  steps: z.lazy(() => LooseArray(BuildkiteStep)).catch([]),
}).transform(({ image, agents, steps }) => ({
  image,
  agentsImage: agents,
  steps,
}));

export interface BuildkiteFile {
  image: string | undefined;
  agentsImage: string | undefined;
  steps: BuildkiteStep[];
}

export const BuildkiteFile = BaseImages.extend({
  steps: LooseArray(BuildkiteStep).catch([]),
}).transform(({ image, agents, steps }) => ({
  image,
  agentsImage: agents,
  steps,
}));
