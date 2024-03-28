import type {SpaceClient} from "./client";
import type {SpaceRepositoryDetails} from "./types";

export class SpaceDao {
  constructor(private client: SpaceClient) {
  }

  async findRepositories(): Promise<string[]> {
    const repos = await this.client.findRepositories()
    return repos.map(it => `${it.projectKey}/${it.repository}`)
  }

  async getRepositoryInfo(projectKey: string, repository: string): Promise<SpaceRepositoryDetails> {
    return await this.client.getRepositoryInfo(projectKey, repository)
  }

  async findMergeRequestBody(codeReviewId: string): Promise<string | undefined> {
    const messages = await this.client.findMergeRequestMessages(codeReviewId, 1, 'asc')
    if (messages.length === 0) {
      return undefined
    }

    return messages.pop()?.details?.description?.text
  }
}
