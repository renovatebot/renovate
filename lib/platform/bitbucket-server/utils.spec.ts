import type { Response } from 'got';
import { partial } from '../../../test/util';
import type { BitbucketError, BitbucketErrorResponse } from './types';
import {
  BITBUCKET_INVALID_REVIEWERS_EXCEPTION,
  getInvalidReviewers,
} from './utils';

describe('platform/bitbucket-server/utils', () => {
  function createError(body: Partial<BitbucketErrorResponse> = undefined) {
    return partial<BitbucketError>({
      response: partial<Response<BitbucketErrorResponse>>({ body }),
    });
  }

  it('getInvalidReviewers', () => {
    expect(
      getInvalidReviewers(
        createError({
          errors: [
            {
              exceptionName: BITBUCKET_INVALID_REVIEWERS_EXCEPTION,
              reviewerErrors: [{ context: 'dummy' }, {}],
            },
          ],
        })
      )
    ).toStrictEqual(['dummy']);
    expect(getInvalidReviewers(createError())).toStrictEqual([]);
    expect(
      getInvalidReviewers(
        createError({
          errors: [{ exceptionName: BITBUCKET_INVALID_REVIEWERS_EXCEPTION }],
        })
      )
    ).toStrictEqual([]);
  });
});
