import { logger } from '../../../logger/index.ts';
import { filterMap } from '../../filter-map.ts';
import type { GithubGraphqlResponse, GithubHttp } from '../../http/github.ts';
import { coerceObject } from '../../object.ts';
import { regEx } from '../../regex.ts';
import { getApiBaseUrl } from '../url.ts';
import {
  type GithubGraphqlTag,
  tagFields,
  adapter as tagsAdapter,
} from './query-adapters/tags-query-adapter.ts';
import type { GithubPackageConfig, GithubTagItem } from './types.ts';

interface GraphqlData {
  repository: Record<string, GithubGraphqlTag | null> | null;
}

/**
 * How many tags are looked up in one query.
 */
export const tagsPerQuery = 100;

/**
 * Each tag is looked up by its name with a `ref` alias, so a query costs the same no matter how many tags the repository has.
 */
function buildQuery(count: number): string {
  const variables: string[] = [];
  const fields: string[] = [];
  for (let i = 0; i < count; i += 1) {
    variables.push(`$tag${i}: String!`);
    fields.push(`tag${i}: ref(qualifiedName: $tag${i}) { ${tagFields} }`);
  }

  return `
    query($owner: String!, $name: String!, ${variables.join(', ')}) {
      repository(owner: $owner, name: $name) {
        ${fields.join('\n')}
      }
    }
  `;
}

async function queryBatch(
  config: GithubPackageConfig,
  http: GithubHttp,
  tagNames: string[],
): Promise<GithubTagItem[]> {
  const { packageName, registryUrl } = config;
  const [owner, name] = packageName.split('/');
  const baseUrl = getApiBaseUrl(registryUrl).replace(regEx(/\/v3\/$/), '/'); // Replace for GHE

  const variables: Record<string, string> = { owner, name };
  tagNames.forEach((tagName, i) => {
    variables[`tag${i}`] = `refs/tags/${tagName}`;
  });

  const { body } = await http.postJson<GithubGraphqlResponse<GraphqlData>>(
    '/graphql',
    {
      baseUrl,
      repository: packageName,
      readOnly: true,
      body: { query: buildQuery(tagNames.length), variables },
    },
  );

  if (body.errors?.length) {
    throw new Error(body.errors[0].message);
  }

  return filterMap(
    Object.values(coerceObject(body.data?.repository)),
    (node) => (node ? tagsAdapter.transform(node) : null),
  );
}

/**
 * Looks up the given tags by name, rather than paginating every tag of the repository.
 *
 * Tags which don't exist, or whose query failed, are left out of the result.
 */
export async function queryTagsByName(
  config: GithubPackageConfig,
  http: GithubHttp,
  tagNames: string[],
): Promise<GithubTagItem[]> {
  const result: GithubTagItem[] = [];
  for (let start = 0; start < tagNames.length; start += tagsPerQuery) {
    const batch = tagNames.slice(start, start + tagsPerQuery);
    try {
      result.push(...(await queryBatch(config, http, batch)));
    } catch (err) {
      logger.debug(
        { err, packageName: config.packageName },
        'Error looking up GitHub tags by name',
      );
    }
  }

  return result;
}
