// SEE for the reference https://github.com/renovatebot/renovate/blob/c3e9e572b225085448d94aa121c7ec81c14d3955/lib/platform/bitbucket/utils.js
import { URL } from 'node:url';
import is from '@sindresorhus/is';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import type { GitOptions, GitProtocol } from '../../../types/git';
import * as git from '../../../util/git';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import { getPrBodyStruct } from '../pr-body';
import type { GitUrlOption } from '../types';
import type { BbsPr, BbsRestPr, BbsRestRepo, BitbucketError } from './types';

export const BITBUCKET_INVALID_REVIEWERS_EXCEPTION =
  'com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException';

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp250
const prStateMapping: any = {
  MERGED: 'merged',
  DECLINED: 'closed',
  OPEN: 'open',
};

export function prInfo(pr: BbsRestPr): BbsPr {
  return {
    version: pr.version,
    number: pr.id,
    bodyStruct: getPrBodyStruct(pr.description),
    sourceBranch: pr.fromRef.displayId,
    targetBranch: pr.toRef.displayId,
    title: pr.title,
    state: prStateMapping[pr.state],
    createdAt: pr.createdDate,
  };
}

export interface BitbucketCommitStatus {
  failed: number;
  inProgress: number;
  successful: number;
}

export type BitbucketBranchState =
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'INPROGRESS'
  | 'STOPPED';

export interface BitbucketStatus {
  key: string;
  state: BitbucketBranchState;
}

export function isInvalidReviewersResponse(err: BitbucketError): boolean {
  const errors = err?.response?.body?.errors ?? [];
  return (
    errors.length > 0 &&
    errors.every(
      (error) => error.exceptionName === BITBUCKET_INVALID_REVIEWERS_EXCEPTION,
    )
  );
}

export function getInvalidReviewers(err: BitbucketError): string[] {
  const errors = err?.response?.body?.errors ?? [];
  let invalidReviewers: string[] = [];
  for (const error of errors) {
    if (error.exceptionName === BITBUCKET_INVALID_REVIEWERS_EXCEPTION) {
      invalidReviewers = invalidReviewers.concat(
        error.reviewerErrors
          ?.map(({ context }) => context)
          .filter(is.nonEmptyString) ?? [],
      );
    }
  }

  return invalidReviewers;
}

function generateUrlFromEndpoint(
  defaultEndpoint: string,
  opts: HostRule,
  repository: string,
): string {
  const url = new URL(defaultEndpoint);
  const generatedUrl = git.getUrl({
    protocol: url.protocol as GitProtocol,
    // TODO: types (#22198)
    auth: `${opts.username}:${opts.password}`,
    host: `${url.host}${url.pathname}${
      /* v8 ignore start */
      url.pathname.endsWith('/') ? '' : '/'
      /* v8 ignore stop */
    }scm`,
    repository,
  });
  logger.debug(`Using generated endpoint URL: ${generatedUrl}`);
  return generatedUrl;
}

function injectAuth(url: string, opts: HostRule): string {
  const repoUrl = parseUrl(url)!;
  if (!repoUrl) {
    logger.debug(`Invalid url: ${url}`);
    throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
  }
  if (!opts.token && opts.username && opts.password) {
    repoUrl.username = opts.username;
    repoUrl.password = opts.password;
  }
  return repoUrl.toString();
}

export function getRepoGitUrl(
  repository: string,
  defaultEndpoint: string,
  gitUrl: GitUrlOption | undefined,
  info: BbsRestRepo,
  opts: HostRule,
): string {
  if (gitUrl === 'ssh') {
    const sshUrl = info.links.clone?.find(({ name }) => name === 'ssh');
    if (sshUrl === undefined) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    logger.debug(`Using ssh URL: ${sshUrl.href}`);
    return sshUrl.href;
  }
  let cloneUrl = info.links.clone?.find(({ name }) => name === 'http');
  if (cloneUrl) {
    // Inject auth into the API provided URL
    return injectAuth(cloneUrl.href, opts);
  }
  // Http access might be disabled, try to find ssh url in this case
  cloneUrl = info.links.clone?.find(({ name }) => name === 'ssh');
  if (gitUrl === 'endpoint' || !cloneUrl) {
    return generateUrlFromEndpoint(defaultEndpoint, opts, repository);
  }
  // SSH urls can be used directly
  return cloneUrl.href;
}

export function getExtraCloneOpts(opts: HostRule): GitOptions {
  if (opts.token) {
    return {
      '-c': `http.extraHeader=Authorization: Bearer ${opts.token}`,
    };
  }
  return {};
}

export function splitEscapedSpaces(str: string): string[] {
  const parts = str.split(' ');
  const result: string[] = [];
  let last: string | undefined;

  for (const part of parts) {
    if (last?.endsWith('\\\\')) {
      result[result.length - 1] = last.slice(0, -2) + ' ' + part;
    } else {
      result.push(part);
    }
    last = result.at(-1);
  }

  return result;
}

export function parseModifier(value: string): number | null {
  const match = regEx('^random(?:\\((\\d+)\\))?$').exec(value);
  if (!match) {
    return null;
  }
  return parseInt(match[1] ?? '1');
}
