import {expect} from '@jest/globals';
import * as httpMock from '../../../../../test/http-mock';
import {SpaceHttp} from '../../../../util/http/space';
import type {CodeReviewStateFilter, SpaceCodeReviewParticipantRole, SpaceMergeRequestRecord} from '../types';
import {SpaceCodeReviewWriteClient} from "./code-review-write";

const spaceEndpointUrl = 'https://myorg.jetbrains.space';
const jsonResultHeader = {'content-type': 'application/json;charset=utf-8'};

describe('modules/platform/space/client/code-review-write', () => {
  const client = new SpaceCodeReviewWriteClient(new SpaceHttp(spaceEndpointUrl));

  describe('create()', () => {
    it('should create code review', async () => {
      const projectKey = 'my-project';
      const repository = 'my-repo';
      const sourceBranch = 'my-branch';
      const targetBranch = 'my-main';
      const title = 'my awesome pull request';

      const response: SpaceMergeRequestRecord = {
        id: '123',
        number: 1,
        title,
        state: 'Opened',
        branchPairs: [{sourceBranch, targetBranch}],
        createdAt: 123,
      };


      httpMock.scope(spaceEndpointUrl)
        .post(`/api/http/projects/key:${projectKey}/code-reviews/merge-requests`, {
          repository,
          sourceBranch,
          targetBranch,
          title
        })
        .reply(
          200,
          response,
          jsonResultHeader,
        );

      expect(await client.create(projectKey, {
        repository,
        sourceBranch,
        targetBranch,
        title
      })).toEqual(response);
    });
  });

  describe('merge()', () => {
    it('should merge code review', async () => {
      const projectKey = 'my-project';
      const codeReviewNumber = 123;
      const mergeMode = 'FF'
      const deleteSourceBranch = true;

      httpMock.scope(spaceEndpointUrl)
        .put(`/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}/merge`, {
          mergeMode,
          deleteSourceBranch,
        })
        .reply(
          200,
          {},
          jsonResultHeader,
        );

      await expect(client.merge(projectKey, codeReviewNumber, mergeMode, deleteSourceBranch)).resolves.not.toThrow();
    });
  });

  describe('rebase()', () => {
    it('should rebase code review', async () => {
      const projectKey = 'my-project';
      const codeReviewNumber = 123;
      const rebaseMode = 'NO_FF'
      const deleteSourceBranch = true;
      const squashedCommitMessage = 'squash message';
      const squash = true

      httpMock.scope(spaceEndpointUrl)
        .put(`/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}/rebase`, {
          rebaseMode,
          deleteSourceBranch,
          squash,
          squashedCommitMessage
        })
        .reply(
          200,
          {},
          jsonResultHeader,
        );

      await expect(client.rebase(projectKey, codeReviewNumber, rebaseMode, squashedCommitMessage, deleteSourceBranch)).resolves.not.toThrow();
    });
  });

  describe('addMessage()', () => {
    it('should add a message to a code review', async () => {
      const codeReviewId = 'my-code-review-id';
      const comment = 'howdy folks'
      const externalId = 'my-external-id';

      httpMock.scope(spaceEndpointUrl)
        .post(`/api/http/chats/messages/send-message`, {
          channel: `codeReview:id:${codeReviewId}`,
          content: {
            className: 'ChatMessage.Text',
            text: comment,
          },
          externalId,
        })
        .reply(
          200,
          {},
          jsonResultHeader,
        );

      await expect(client.addMessage(codeReviewId, comment, externalId)).resolves.not.toThrow();
    });
  });

  describe('deleteMessage()', () => {
    it('should delete a message from a code review', async () => {
      const codeReviewId = 'my-code-review-id';
      const messageId = 'my-message-id'

      httpMock.scope(spaceEndpointUrl)
        .post(`/api/http/chats/messages/delete-message`, {
          channel: `codeReview:id:${codeReviewId}`,
          id: `id:${messageId}`,
        })
        .reply(
          200,
          {},
          jsonResultHeader,
        );

      await expect(client.deleteMessage(codeReviewId, messageId)).resolves.not.toThrow();
    });
  });

  describe('addReviewer()', () => {
    it('should add a reviewer to a code review', async () => {
      const projectKey = 'my-project-key'
      const codeReviewNumber = 123;
      const username = 'my-awesome-user'
      const role: SpaceCodeReviewParticipantRole = 'Reviewer'

      httpMock.scope(spaceEndpointUrl)
        .post(`/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}/participants/username:${username}`, {
          role
        })
        .reply(
          200,
          {},
          jsonResultHeader,
        );

      await expect(client.addReviewer(projectKey, codeReviewNumber, username, role)).resolves.not.toThrow();
    });
  });

  describe('setTitle()', () => {
    it('should set a title for a code review', async () => {
      const projectKey = 'my-project-key'
      const codeReviewId = 'my-code-review';
      const title = 'This is an awesome Code Review'

      httpMock.scope(spaceEndpointUrl)
        .patch(`/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}/title`, {
          title
        })
        .reply(
          200,
          {},
          jsonResultHeader,
        );

      await expect(client.setTitle(projectKey, codeReviewId, title)).resolves.not.toThrow();
    });
  });

  describe('setDescription()', () => {
    it('should set a description for a code review', async () => {
      const projectKey = 'my-project-key'
      const codeReviewId = 'my-code-review';
      const description = 'Please do your thing for this PR'

      httpMock.scope(spaceEndpointUrl)
        .patch(`/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}/description`, {
          description
        })
        .reply(
          200,
          {},
          jsonResultHeader,
        );

      await expect(client.setDescription(projectKey, codeReviewId, description)).resolves.not.toThrow();
    });
  });

  describe('setState()', () => {
    it('should set a state for a code review', async () => {
      const projectKey = 'my-project-key'
      const codeReviewId = 'my-code-review';
      const state: CodeReviewStateFilter = 'Closed'

      httpMock.scope(spaceEndpointUrl)
        .patch(`/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}/state`, {
          state
        })
        .reply(
          200,
          {},
          jsonResultHeader,
        );

      await expect(client.setState(projectKey, codeReviewId, state)).resolves.not.toThrow();
    });
  });
});
