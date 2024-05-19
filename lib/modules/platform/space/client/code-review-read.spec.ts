import { expect } from '@jest/globals';
import * as httpMock from '../../../../../test/http-mock';
import { SpaceHttp } from '../../../../util/http/space';
import type {
  CodeReviewStateFilter,
  SpaceCodeReviewBasicInfo,
  SpaceMergeRequestRecord,
} from '../types';
import {
  SpaceCodeReviewReadClient,
  type SpaceMergeRequestRecordPredicate,
} from './code-review-read';

const spaceEndpointUrl = 'https://myorg.jetbrains.space';
const jsonResultHeader = { 'content-type': 'application/json;charset=utf-8' };

describe('modules/platform/space/client/code-review-read', () => {
  const client = new SpaceCodeReviewReadClient(new SpaceHttp(spaceEndpointUrl));

  const codeReview1: SpaceMergeRequestRecord = {
    id: '123',
    number: 1,
    title: 'my code review',
    state: 'Opened',
    branchPairs: [{ sourceBranch: 'main', targetBranch: 'feature' }],
  };

  const codeReview2: SpaceMergeRequestRecord = {
    id: '456',
    number: 2,
    title: 'my code review 2',
    state: 'Opened',
    branchPairs: [{ sourceBranch: 'main', targetBranch: 'feature' }],
  };

  describe('getByCodeReviewId()', () => {
    it('should get code review by id', async () => {
      const projectKey = 'my-project';

      mockCodeReviewById(projectKey, codeReview1);

      expect(
        await client.getByCodeReviewId(projectKey, codeReview1.id),
      ).toEqual(codeReview1);
    });
  });

  describe('getByCodeReviewNumber()', () => {
    it('should get code review by number', async () => {
      const projectKey = 'my-project';

      httpMock
        .scope(spaceEndpointUrl)
        .get(
          `/api/http/projects/key:${projectKey}/code-reviews/number:${codeReview1.number}`,
        )
        .reply(200, codeReview1, jsonResultHeader);

      expect(
        await client.getByCodeReviewNumber(projectKey, codeReview1.number),
      ).toEqual(codeReview1);
    });
  });

  describe('find()', () => {
    it('should find all code reviews', async () => {
      const projectKey = 'my-project';

      mockCodeReviewPage(
        projectKey,
        'null',
        [
          {
            review: { className: 'MergeRequestRecord', id: codeReview1.id },
          },
        ],
        '1',
      );

      mockCodeReviewPage(
        projectKey,
        'null',
        [
          {
            review: { className: 'MergeRequestRecord', id: codeReview2.id },
          },
        ],
        '2',
        '1',
      );

      mockCodeReviewPage(projectKey, 'null', [], '2', '2');

      mockCodeReviewById(projectKey, codeReview1);
      mockCodeReviewById(projectKey, codeReview2);

      expect(await client.find(projectKey)).toEqual([codeReview1, codeReview2]);
    });

    it('should find code review with repository filter', async () => {
      const projectKey = 'my-project';
      const repository = 'my-repository';

      mockCodeReviewPage(
        projectKey,
        'null',
        [
          {
            review: { className: 'MergeRequestRecord', id: codeReview1.id },
          },
        ],
        '1',
        undefined,
        repository,
      );

      mockCodeReviewPage(projectKey, 'null', [], '1', '1', repository);

      mockCodeReviewById(projectKey, codeReview1);

      expect(await client.find(projectKey, { repository })).toEqual([
        codeReview1,
      ]);
    });

    it('should find with filtering by a predicate', async () => {
      const projectKey = 'my-project';

      mockCodeReviewPage(
        projectKey,
        'null',
        [
          {
            review: { className: 'MergeRequestRecord', id: codeReview1.id },
          },
        ],
        '1',
      );

      mockCodeReviewPage(
        projectKey,
        'null',
        [
          {
            review: { className: 'MergeRequestRecord', id: codeReview2.id },
          },
        ],
        '2',
        '1',
      );

      mockCodeReviewPage(projectKey, 'null', [], '2', '2');

      mockCodeReviewById(projectKey, codeReview1);
      mockCodeReviewById(projectKey, codeReview2);

      const predicate: SpaceMergeRequestRecordPredicate = {
        test: (pr) => Promise.resolve(pr.id === codeReview2.id),
      };

      expect(await client.find(projectKey, { predicate })).toEqual([
        codeReview2,
      ]);
    });
  });
});

function mockCodeReviewById(
  projectKey: string,
  codeReview: SpaceMergeRequestRecord,
) {
  httpMock
    .scope(spaceEndpointUrl)
    .get(
      `/api/http/projects/key:${projectKey}/code-reviews/id:${codeReview.id}`,
    )
    .reply(200, codeReview, jsonResultHeader);
}

function mockCodeReviewPage(
  projectKey: string,
  prState: CodeReviewStateFilter,
  reviews: SpaceCodeReviewBasicInfo[],
  next: string,
  nextQuery?: string,
  repository?: string,
) {
  let path = `/api/http/projects/key:${projectKey}/code-reviews?$top=1&state=${prState}`;
  if (repository) {
    path += `&repository=${repository}`;
  }

  if (nextQuery) {
    path += `&$skip=${nextQuery}`;
  }

  httpMock.scope(spaceEndpointUrl).get(path).reply(
    200,
    {
      next,
      data: reviews,
    },
    jsonResultHeader,
  );
}
