import { z } from 'zod';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { LooseRecord } from '../../../util/schema-utils';

const SHORT_REPO_REGEX = regEx(
  /^((?<platform>bitbucket|github|gitlab):)?(?<shortRepo>[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/,
);

const platformMapping: Record<string, string> = {
  bitbucket: 'https://bitbucket.org/',
  github: 'https://github.com/',
  gitlab: 'https://gitlab.com/',
};

const Repository = z.union([
  z
    .string()
    .nonempty()
    .transform((repository) => {
      let url: string | undefined;
      const shortMatch = repository.match(SHORT_REPO_REGEX);
      if (shortMatch?.groups) {
        const { platform = 'github', shortRepo } = shortMatch.groups;
        url = platformMapping[platform] + shortRepo;
      } else {
        url = repository;
      }
      return { url, directory: undefined };
    }),
  z.object({
    url: z.string().nonempty().optional().catch(undefined),
    directory: z.string().nonempty().optional().catch(undefined),
  }),
]);

const NpmResponseVersion = z
  .object({
    repository: Repository.optional().catch(undefined),
    homepage: z.string().optional().catch(undefined),
    deprecated: z.union([z.boolean(), z.string()]).catch(false),
    gitHead: z.string().optional().catch(undefined),
    dependencies: z.record(z.string()).optional().catch(undefined),
    devDependencies: z.record(z.string()).optional().catch(undefined),
    engines: z.record(z.string()).optional().catch(undefined),
    'renovate-config': z
      .record(z.any())
      .optional()
      .catch(
        /* istanbul ignore next */
        () => {
          logger.debug(`Skipping 'renovate-config': object was expected`);
          return undefined;
        },
      ),
  })
  .transform(({ 'renovate-config': npmHostedPresets, ...rest }) => ({
    npmHostedPresets,
    ...rest,
  }));
type NpmResponseVersion = z.infer<typeof NpmResponseVersion>;

export const NpmResponse = z
  .object({
    name: z.string(),
    versions: LooseRecord(NpmResponseVersion).catch({}),
    repository: Repository.optional().catch(undefined),
    homepage: z.string().optional().catch(undefined),
    time: z.record(z.string()).optional().catch(undefined),
    'dist-tags': LooseRecord(z.string()).catch({}),
  })
  .transform(({ 'dist-tags': tags, versions, ...rest }) => {
    const latest: string | undefined = tags['latest'];
    const latestVersion = versions[latest] as NpmResponseVersion | undefined;
    return { tags, versions, latestVersion, ...rest };
  });
