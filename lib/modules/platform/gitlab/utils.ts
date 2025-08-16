import url from 'node:url';
import is from '@sindresorhus/is';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { getEnv } from '../../../util/env';
import * as hostRules from '../../../util/host-rules';
import type { HttpResponse } from '../../../util/http/types';
import { parseUrl } from '../../../util/url';
import { getPrBodyStruct } from '../pr-body';
import type { GitUrlOption } from '../types';
import type { GitLabMergeRequest, GitlabPr, RepoResponse } from './types';

export const DRAFT_PREFIX = 'Draft: ';
export const DRAFT_PREFIX_DEPRECATED = 'WIP: ';

export const defaults = {
  hostType: 'gitlab',
  endpoint: 'https://gitlab.com/api/v4/',
  version: '0.0.0',
};

export function prInfo(mr: GitLabMergeRequest): GitlabPr {
  const pr: GitlabPr = {
    sourceBranch: mr.source_branch,
    state: mr.state === 'opened' ? 'open' : mr.state,
    number: mr.iid,
    title: mr.title,
    createdAt: mr.created_at,
    hasAssignees: !!(mr.assignee?.id ?? mr.assignees?.[0]?.id),
    bodyStruct: getPrBodyStruct(mr.description),

    ...(mr.target_branch && { targetBranch: mr.target_branch }),

    ...(mr.head_pipeline?.status && {
      headPipelineStatus: mr.head_pipeline?.status,
    }),
    ...(mr.head_pipeline?.sha && { headPipelineSha: mr.head_pipeline?.sha }),

    ...(is.nonEmptyArray(mr.reviewers) && {
      reviewers: mr.reviewers?.map(({ username }) => username),
    }),

    ...(mr.labels && { labels: mr.labels }),
    ...(mr.sha && { sha: mr.sha }),
  };

  if (pr.title.startsWith(DRAFT_PREFIX)) {
    pr.title = pr.title.substring(DRAFT_PREFIX.length);
    pr.isDraft = true;
  } else if (pr.title.startsWith(DRAFT_PREFIX_DEPRECATED)) {
    pr.title = pr.title.substring(DRAFT_PREFIX_DEPRECATED.length);
    pr.isDraft = true;
  }

  return pr;
}

export function getRepoUrl(
  repository: string,
  gitUrl: GitUrlOption | undefined,
  res: HttpResponse<RepoResponse>,
): string {
  if (gitUrl === 'ssh') {
    if (!res.body.ssh_url_to_repo) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    logger.debug(`Using ssh URL: ${res.body.ssh_url_to_repo}`);
    return res.body.ssh_url_to_repo;
  }

  const opts = hostRules.find({
    hostType: defaults.hostType,
    url: defaults.endpoint,
  });
  const env = getEnv();

  if (
    gitUrl === 'endpoint' ||
    is.nonEmptyString(env.GITLAB_IGNORE_REPO_URL) ||
    res.body.http_url_to_repo === null
  ) {
    if (res.body.http_url_to_repo === null) {
      logger.debug('no http_url_to_repo found. Falling back to old behavior.');
    }
    if (env.GITLAB_IGNORE_REPO_URL) {
      logger.warn(
        'GITLAB_IGNORE_REPO_URL environment variable is deprecated. Please use "gitUrl" option.',
      );
    }

    // TODO: null check (#22198)
    const { protocol, host, pathname } = parseUrl(defaults.endpoint)!;
    const newPathname = pathname.slice(0, pathname.indexOf('/api'));
    const uri = url.format({
      protocol:
        /* v8 ignore next: should never happen */
        protocol.slice(0, -1) || 'https',
      // TODO: types (#22198)
      auth: `oauth2:${opts.token!}`,
      host,
      pathname: `${newPathname}/${repository}.git`,
    });
    logger.debug(`Using URL based on configured endpoint, url:${uri}`);
    return uri;
  }

  logger.debug(`Using http URL: ${res.body.http_url_to_repo}`);
  const repoUrl = parseUrl(res.body.http_url_to_repo);
  // should never happen, but bad tests are causing that
  if (!repoUrl) {
    return '';
  }
  repoUrl.username = 'oauth2';
  repoUrl.password = opts.token!;
  return repoUrl.toString();
}
