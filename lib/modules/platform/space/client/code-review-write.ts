import { logger } from '../../../../logger';
import type { SpaceHttp } from '../../../../util/http/space';
import type {
  CodeReviewStateFilter,
  SpaceCodeReviewCreateRequest,
  SpaceCodeReviewParticipantRole,
  SpaceMergeRequestRecord,
} from '../types';

export class SpaceCodeReviewWriteClient {
  constructor(private http: SpaceHttp) {}

  async create(
    projectKey: string,
    request: SpaceCodeReviewCreateRequest,
  ): Promise<SpaceMergeRequestRecord> {
    logger.debug(
      `SPACE: create: projectKey=${projectKey}, request=${JSON.stringify(request)}`,
    );

    const response = await this.http.postJson<SpaceMergeRequestRecord>(
      `/api/http/projects/key:${projectKey}/code-reviews/merge-requests`,
      { body: request },
    );
    logger.debug(
      `SPACE: create: response: ${JSON.stringify(response.body)}`,
    );

    return response.body;
  }

  async merge(
    projectKey: string,
    codeReviewNumber: number,
    mergeMode: 'FF' | 'FF_ONLY' | 'NO_FF',
    deleteSourceBranch: boolean,
  ): Promise<void> {
    logger.debug(
      `SPACE mergeMergeRequest(${projectKey}, ${codeReviewNumber}, ${mergeMode}, ${deleteSourceBranch})`,
    );

    await this.http.putJson(
      `/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}/merge`,
      { body: { mergeMode, deleteSourceBranch } },
    );
  }

  async rebase(
    projectKey: string,
    codeReviewNumber: number,
    rebaseMode: 'FF' | 'NO_FF',
    squashedCommitMessage: string | null,
    deleteSourceBranch: boolean,
  ): Promise<void> {
    logger.debug(
      `SPACE rebaseMergeRequest(${projectKey}, ${codeReviewNumber}, ${rebaseMode}, ${squashedCommitMessage}, ${deleteSourceBranch})`,
    );

    const squash = !!squashedCommitMessage;
    await this.http.putJson(
      `/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}/rebase`,
      {
        body: { rebaseMode, deleteSourceBranch, squash, squashedCommitMessage },
      },
    );
  }

  async addMessage(
    codeReviewId: string,
    comment: string,
    externalId: string | null,
  ): Promise<void> {
    logger.debug(`SPACE addCodeReviewComment(${codeReviewId}, ${comment})`);

    await this.http.postJson(`/api/http/chats/messages/send-message`, {
      body: {
        channel: `codeReview:id:${codeReviewId}`,
        content: {
          className: 'ChatMessage.Text',
          text: comment,
        },
        externalId,
      },
    });
  }

  async deleteMessage(codeReviewId: string, messageId: string): Promise<void> {
    logger.debug(
      `SPACE deleteCodeReviewCommentByExternalId(${codeReviewId}, ${messageId})`,
    );

    await this.http.postJson(`/api/http/chats/messages/delete-message`, {
      body: {
        channel: `codeReview:id:${codeReviewId}`,
        id: `id:${messageId}`,
      },
    });
  }

  async addReviewer(
    projectKey: string,
    codeReviewNumber: number,
    username: string,
    role: SpaceCodeReviewParticipantRole,
  ): Promise<void> {
    logger.debug(
      `SPACE addReviewer(${projectKey}, ${codeReviewNumber}, ${username}, ${role})`,
    );

    await this.http.postJson(
      `/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}/participants/username:${username}`,
      { body: { role } },
    );
  }

  async setTitle(
    projectKey: string,
    codeReviewId: string,
    title: string,
  ): Promise<void> {
    await this.http.patchJson(
      `/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}/title`,
      { body: { title } },
    );
  }

  async setDescription(
    projectKey: string,
    codeReviewId: string,
    description: string,
  ): Promise<void> {
    logger.debug(
      `SPACE: updateCodeReviewDescription: projectKey=${projectKey}, codeReviewId=${codeReviewId}, description=${description}`,
    );
    await this.http.patchJson(
      `/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}/description`,
      { body: { description } },
    );
  }

  async setState(
    projectKey: string,
    codeReviewId: string,
    state: CodeReviewStateFilter,
  ): Promise<void> {
    logger.debug(
      `SPACE: updateCodeReviewState: projectKey=${projectKey}, codeReviewId=${codeReviewId}, state=${state}`,
    );
    await this.http.patchJson(
      `/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}/state`,
      { body: { state } },
    );
  }
}
