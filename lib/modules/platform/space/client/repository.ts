import { logger } from '../../../../logger';
import type { SpaceHttp } from '../../../../util/http/space';
import { PaginatedIterable } from '../paginated-iterator';
import type {
  SpaceBranchHead,
  SpaceFileContent,
  SpaceRepositoryBasicInfo,
  SpaceRepositoryDetails,
} from '../types';
import { flatten } from '../utils';

export class SpaceRepositoryClient {
  constructor(private http: SpaceHttp) {}

  async getAll(): Promise<SpaceRepositoryBasicInfo[]> {
    const iterable =
      PaginatedIterable.fromGetUsingSkip<SpaceRepositoryBasicInfo>(
        this.http,
        '/api/http/projects/repositories/find?term=',
      );
    return await flatten(iterable);
  }

  async getByName(
    projectKey: string,
    repository: string,
  ): Promise<SpaceRepositoryDetails> {
    logger.trace(
      `SPACE: getRepositoryInfo: repository=${repository}, projectKey=${projectKey}`,
    );
    const repoInfo = await this.http.getJson<SpaceRepositoryDetails>(
      `/api/http/projects/key:${projectKey}/repositories/${repository}`,
    );
    return repoInfo.body;
  }

  async getBranchesHeads(
    projectKey: string,
    repository: string,
  ): Promise<SpaceBranchHead[]> {
    logger.trace(
      `SPACE: getRepositoriesHeads: projectKey=${projectKey}, repository=${repository}`,
    );

    const iterable = PaginatedIterable.fromGetUsingSkip<SpaceBranchHead>(
      this.http,
      `/api/http/projects/key:${projectKey}/repositories/${repository}/heads`,
    );

    return await flatten(iterable);
  }

  async getFileContent(
    projectKey: string,
    repository: string,
    path: string,
    commit: string,
  ): Promise<string> {
    logger.trace(
      `SPACE getFileTextContent(${projectKey}, ${repository}, ${commit}, ${path})`,
    );

    const fileContent = await this.http.getJson<SpaceFileContent>(
      `/api/http/projects/key:${projectKey}/repositories/${repository}/text-content?commit=${commit}&path=${path}`,
    );
    const body = fileContent.body;
    return body.lines.map((it) => it.text).join('\n');
  }
}
