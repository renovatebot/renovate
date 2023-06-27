import { logger } from '../../../logger';
import { BitbucketHttp } from '../../../util/http/bitbucket';
import type { Account, Config, EffectiveReviewer, PagedResult } from './types';

const bitbucketHttp = new BitbucketHttp();

export type ReviewerConfig = Pick<Config, 'repository'>;

export async function effectiveDefaultReviewers(
  repository: string
): Promise<Account[]> {
  const reviewersResponse = (
    await bitbucketHttp.getJson<PagedResult<EffectiveReviewer>>(
      `/2.0/repositories/${repository}/effective-default-reviewers`,
      {
        paginate: true,
      }
    )
  ).body;
  const reviewers = reviewersResponse.values.map(
    (reviewer: EffectiveReviewer) => ({
      uuid: reviewer.user.uuid,
      display_name: reviewer.user.display_name,
    })
  );
  return reviewers;
}

export async function sanitizeReviewers(
  config: ReviewerConfig,
  reviewers: Account[],
  err: any
): Promise<Account[] | undefined> {
  if (err.statusCode === 400 && err.body?.error?.fields?.reviewers) {
    const sanitizedReviewers: Account[] = [];

    const MSG_AUTHOR_AND_REVIEWER =
      'is the author and cannot be included as a reviewer.';
    const MSG_MALFORMED_REVIEWERS_LIST = 'Malformed reviewers list';
    const MSG_NOT_WORKSPACE_MEMBER =
      'is not a member of this workspace and cannot be added to this pull request';

    for (const msg of err.body.error.fields.reviewers) {
      // Bitbucket returns a 400 if any of the PR reviewer accounts are now inactive (ie: disabled/suspended)
      if (msg === MSG_MALFORMED_REVIEWERS_LIST) {
        logger.debug(
          { err },
          'PR contains reviewers that may be either inactive or no longer a member of this workspace. Will try setting only active reviewers'
        );

        // Validate that each previous PR reviewer account is still active
        for (const reviewer of reviewers) {
          const reviewerUser = (
            await bitbucketHttp.getJson<Account>(`/2.0/users/${reviewer.uuid}`)
          ).body;

          if (reviewerUser.account_status === 'active') {
            // There are cases where an active user may still not be a member of a workspace
            if (await isAccountMemberOfWorkspace(reviewer, config.repository)) {
              sanitizedReviewers.push(reviewer);
            }
          }
        }
        // Bitbucket returns a 400 if any of the PR reviewer accounts are no longer members of this workspace
      } else if (msg.endsWith(MSG_NOT_WORKSPACE_MEMBER)) {
        logger.debug(
          { err },
          'PR contains reviewer accounts which are no longer member of this workspace. Will try setting only member reviewers'
        );

        // Validate that each previous PR reviewer account is still a member of this workspace
        for (const reviewer of reviewers) {
          if (await isAccountMemberOfWorkspace(reviewer, config.repository)) {
            sanitizedReviewers.push(reviewer);
          }
        }
      } else if (msg.endsWith(MSG_AUTHOR_AND_REVIEWER)) {
        logger.debug(
          { err },
          'PR contains reviewer accounts which are also the author. Will try setting only non-author reviewers'
        );
        const author = msg.replace(MSG_AUTHOR_AND_REVIEWER, '').trim();
        for (const reviewer of reviewers) {
          if (reviewer.display_name !== author) {
            sanitizedReviewers.push(reviewer);
          }
        }
      } else {
        return undefined;
      }
    }

    return sanitizedReviewers;
  }

  return undefined;
}

async function isAccountMemberOfWorkspace(
  reviewer: Account,
  repository: string
): Promise<boolean> {
  const workspace = repository.split('/')[0];

  try {
    await bitbucketHttp.get(
      `/2.0/workspaces/${workspace}/members/${reviewer.uuid}`
    );

    return true;
  } catch (err) {
    // HTTP 404: User cannot be found, or the user is not a member of this workspace.
    if (err.statusCode === 404) {
      logger.debug(
        { err },
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `User ${reviewer.display_name} is not a member of the workspace ${workspace}. Will be removed from the PR`
      );

      return false;
    }
    throw err;
  }
}
