import { GithubHttp } from '../../../util/http/github';
import { regEx } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

const PROVIDER_NAMESPACE_REGEX = regEx(/^(?<providerNamespace>.*?)\//);

const getProviderNamespacesQuery = `
query GetAllProviderNamespaces {
  repository(name: "azure-rest-api-specs", owner: "Azure") {
    object(expression: "main:specification") {
      ... on Tree {
        entries {
          name
          type
          object {
            ... on Tree {
              entries {
                name
                type
                object {
                  ... on Tree {
                    entries {
                      name
                      type
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

interface Response1 {
  repository: {
    object: {
      entries: {
        name: string;
        type: 'tree' | 'blob';
        object: {
          entries: {
            name: string;
            type: 'tree' | 'blob';
            object: {
              entries: {
                name: string;
                type: 'tree' | 'blob';
              }[];
            };
          }[];
        };
      }[];
    };
  };
}

const GetAllVersionsQuery = `
query GetVersions {
  repository(name: "azure-rest-api-specs", owner: "Azure") {
    object(
      expression: "main:specification/storage/resource-manager/Microsoft.Storage"
    ) {
      ... on Tree {
        entries {
          name
          type
          object {
            ... on Tree {
              entries {
                name
                type
              }
            }
          }
        }
      }
    }
  }
}`;

interface Response2 {
  repository: {
    object: {
      entries: {
        name: 'stable' | 'preview';
        type: 'tree' | 'blob';
        object: {
          entries: {
            name: string;
            type: 'tree' | 'blob';
          }[];
        };
      }[];
    };
  };
}

export class AzureRestApiSpecDatasource extends Datasource {
  static readonly id = 'azure-rest-api-spec';

  constructor() {
    super(AzureRestApiSpecDatasource.id);
  }

  // TODO caching via @cache decorator
  async getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult | null> {
    const { packageName } = getReleasesConfig;

    const providerNamespace =
      AzureRestApiSpecDatasource.parseProviderNamespace(packageName);

    if (!providerNamespace) {
      // TODO: just return null when this method is async
      return null;
    }

    const githubApi = new GithubHttp();

    const res = await githubApi.requestGraphql<Response1>(
      getProviderNamespacesQuery
    );

    const treeEntries = res?.data?.repository?.object?.entries;

    if (!treeEntries) {
      throw new Error('this is bad');
    }

    const lol: Record<string, string> = {};
    for (const treeEntry of treeEntries.filter((x) => x.type === 'tree')) {
      const l1 = treeEntry.name;

      const resourceManagerNode = treeEntry.object.entries.find(
        (x) => x.name === 'resource-manager' && x.type === 'tree'
      );

      if (!resourceManagerNode) {
        continue;
      }

      const l2 = resourceManagerNode.name;

      const providerNamespaceNode = resourceManagerNode.object.entries.find(
        (x) => x.type === 'tree'
      );

      if (!providerNamespaceNode) {
        throw new Error('this is bad');
      }

      const l3 = providerNamespaceNode.name;

      lol[l3] = `${l1}/${l2}/${l3}`;
    }

    const providerNamespacePath = lol[providerNamespace];

    if (!providerNamespacePath) {
      return null;
    }

    // TODO use variables in query
    const res2 = await githubApi.requestGraphql<Response2>(GetAllVersionsQuery);

    // TODO: get preview and stable versions for provider namespace
    const data2 = res2?.data?.repository?.object?.entries;

    if (!data2) {
      throw new Error('uh oh');
    }

    const stableVersions = data2
      .find((x) => x.name === 'stable')!
      .object.entries.filter((x) => x.type === 'tree')
      .map((x) => x.name);
    const previewVersions = data2
      .find((x) => x.name === 'preview')!
      .object.entries.filter((x) => x.type === 'tree')
      .map((x) => x.name);

    const versions = stableVersions.concat(previewVersions);

    return {
      releases: versions.map((x) => ({
        version: x,
      })),
    };
  }

  private static parseProviderNamespace(
    packageName: string
  ): string | undefined {
    const match = PROVIDER_NAMESPACE_REGEX.exec(packageName);
    return match?.groups?.providerNamespace;
  }
}
