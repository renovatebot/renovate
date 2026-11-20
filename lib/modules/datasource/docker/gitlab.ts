import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { Http } from '../../../util/http/index.ts';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp, type Timestamp } from '../../../util/timestamp.ts';
import {
  ensureTrailingSlash,
  joinUrlParts,
  parseUrl,
} from '../../../util/url.ts';
import type { RegistryTimestampsConfig } from './types.ts';

const http = new Http('gitlab');

const gitlabComApiUrl = 'https://gitlab.com/api/v4';

/** GitLab may return fewer tags per page than requested */
const tagsPageSize = 100;

/** Upper bound on tag pages fetched per repository, newest tags first, so only the oldest tags miss a timestamp */
const maxTagsPages = 50;

const ContainerRepositories = LooseArray(
  z.object({
    id: z.number(),
    path: z.string(),
  }),
);

const ContainerRepositoryTags = z.object({
  data: z.object({
    containerRepository: z
      .object({
        tags: z.object({
          pageInfo: z.object({
            hasNextPage: z.boolean(),
            endCursor: z.string().nullable(),
          }),
          nodes: LooseArray(
            z.object({
              name: z.string(),
              publishedAt: MaybeTimestamp,
            }),
          ),
        }),
      })
      .nullable(),
  }),
});
type ContainerRepositoryTags = z.infer<typeof ContainerRepositoryTags>;

const tagsQuery = `
query($id: ContainerRepositoryID!, $first: Int!, $after: String) {
  containerRepository(id: $id) {
    tags(first: $first, after: $after, sort: PUBLISHED_AT_DESC) {
      pageInfo { hasNextPage endCursor }
      nodes { name publishedAt }
    }
  }
}`;

function getApiUrl(registryHost: string, registryApiUrl?: string): string {
  if (registryApiUrl) {
    return registryApiUrl;
  }

  const hostname = parseUrl(registryHost)?.hostname;
  if (hostname === 'registry.gitlab.com') {
    return gitlabComApiUrl;
  }

  // Assumes the API is served from the registry host, which is only the case when GitLab serves its registry under the same domain
  return joinUrlParts(registryHost, 'api/v4');
}

/**
 * Returns the GitLab project paths that could own a container repository, longest first, as images may be nested below their project path.
 */
function getCandidateProjectPaths(dockerRepository: string): string[] {
  const segments = dockerRepository.split('/');
  const candidates: string[] = [];
  for (let length = segments.length; length >= 2; length--) {
    candidates.push(segments.slice(0, length).join('/'));
  }
  return candidates;
}

async function getContainerRepositoryId(
  apiUrl: string,
  dockerRepository: string,
): Promise<number | null> {
  for (const projectPath of getCandidateProjectPaths(dockerRepository)) {
    const url = joinUrlParts(
      apiUrl,
      'projects',
      encodeURIComponent(projectPath),
      'registry/repositories?per_page=100',
    );
    const { val: repositories, err } = await http
      .getJsonSafe(url, ContainerRepositories)
      .unwrap();
    if (err) {
      logger.trace(
        { err },
        `Docker: GitLab project ${projectPath} has no accessible container repositories`,
      );
      continue;
    }

    const repository = repositories.find(
      ({ path }) => path === dockerRepository,
    );
    if (repository) {
      return repository.id;
    }
  }

  return null;
}

async function getTagsPage(
  graphqlUrl: string,
  repositoryId: number,
  after: string | null,
): Promise<ContainerRepositoryTags> {
  const { body } = await http.postJson(
    graphqlUrl,
    {
      body: {
        query: tagsQuery,
        variables: {
          id: `gid://gitlab/ContainerRepository/${repositoryId}`,
          first: tagsPageSize,
          after,
        },
      },
    },
    ContainerRepositoryTags,
  );
  return body;
}

async function getTagTimestamps(
  apiUrl: string,
  repositoryId: number,
): Promise<Map<string, Timestamp>> {
  const graphqlUrl = `${ensureTrailingSlash(parseUrl(apiUrl)!.origin)}api/graphql`;
  const timestamps = new Map<string, Timestamp>();
  let after: string | null = null;
  for (let page = 0; page < maxTagsPages; page++) {
    const body = await getTagsPage(graphqlUrl, repositoryId, after);
    const tags = body.data.containerRepository?.tags;
    if (!tags) {
      break;
    }

    for (const { name, publishedAt } of tags.nodes) {
      if (publishedAt) {
        timestamps.set(name, publishedAt);
      }
    }

    if (!tags.pageInfo.hasNextPage) {
      break;
    }
    after = tags.pageInfo.endCursor;
  }

  return timestamps;
}

/**
 * Returns the time each tag was last pushed, as recorded by the GitLab container registry.
 */
export async function getGitlabTagTimestamps({
  registryHost,
  dockerRepository,
  registryApiUrl,
}: RegistryTimestampsConfig): Promise<Map<string, Timestamp> | null> {
  const apiUrl = getApiUrl(registryHost, registryApiUrl);
  const repositoryId = await getContainerRepositoryId(apiUrl, dockerRepository);
  if (!repositoryId) {
    logger.debug(
      `Docker: no GitLab container repository found for ${dockerRepository} at ${apiUrl}`,
    );
    return null;
  }

  return getTagTimestamps(apiUrl, repositoryId);
}
