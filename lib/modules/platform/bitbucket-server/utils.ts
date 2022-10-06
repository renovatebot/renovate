// SEE for the reference https://github.com/renovatebot/renovate/blob/c3e9e572b225085448d94aa121c7ec81c14d3955/lib/platform/bitbucket/utils.js
import url from 'url';
import is from '@sindresorhus/is';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { HostRule, PrState } from '../../../types';
import type { GitProtocol } from '../../../types/git';
import * as git from '../../../util/git';
import { BitbucketServerHttp } from '../../../util/http/bitbucket-server';
import type { HttpOptions, HttpResponse } from '../../../util/http/types';
import { parseUrl } from '../../../util/url';
import { getPrBodyStruct } from '../pr-body';
import type { GitUrlOption } from '../types';
import type { BbsPr, BbsRestPr, BbsRestRepo, BitbucketError } from './types';

export const BITBUCKET_INVALID_REVIEWERS_EXCEPTION =
  'com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException';

const bitbucketServerHttp = new BitbucketServerHttp();

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp250
const prStateMapping: any = {
  MERGED: PrState.Merged,
  DECLINED: PrState.Closed,
  OPEN: PrState.Open,
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

const addMaxLength = (inputUrl: string, limit = 100): string => {
  const { search, ...parsedUrl } = url.parse(inputUrl, true); // eslint-disable-line @typescript-eslint/no-unused-vars
  const maxedUrl = url.format({
    ...parsedUrl,
    query: { ...parsedUrl.query, limit },
  });
  return maxedUrl;
};

function callApi<T>(
  apiUrl: string,
  method: string,
  options?: HttpOptions
): Promise<HttpResponse<T>> {
  /* istanbul ignore next */
  switch (method.toLowerCase()) {
    case 'post':
      return bitbucketServerHttp.postJson<T>(apiUrl, options);
    case 'put':
      return bitbucketServerHttp.putJson<T>(apiUrl, options);
    case 'patch':
      return bitbucketServerHttp.patchJson<T>(apiUrl, options);
    case 'head':
      return bitbucketServerHttp.headJson<T>(apiUrl, options);
    case 'delete':
      return bitbucketServerHttp.deleteJson<T>(apiUrl, options);
    case 'get':
    default:
      return bitbucketServerHttp.getJson<T>(apiUrl, options);
  }
}

export async function accumulateValues<T = any>(
  reqUrl: string,
  method = 'get',
  options?: HttpOptions,
  limit?: number
): Promise<T[]> {
  let accumulator: T[] = [];
  let nextUrl = addMaxLength(reqUrl, limit);

  while (typeof nextUrl !== 'undefined') {
    // TODO: fix typing (#9610)
    const { body } = await callApi<{
      values: T[];
      isLastPage: boolean;
      nextPageStart: string;
    }>(nextUrl, method, options);
    accumulator = [...accumulator, ...body.values];
    if (body.isLastPage !== false) {
      break;
    }

    const { search, ...parsedUrl } = url.parse(nextUrl, true); // eslint-disable-line @typescript-eslint/no-unused-vars
    nextUrl = url.format({
      ...parsedUrl,
      query: {
        ...parsedUrl.query,
        start: body.nextPageStart,
      },
    });
  }

  return accumulator;
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
      (error) => error.exceptionName === BITBUCKET_INVALID_REVIEWERS_EXCEPTION
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
          .filter(is.nonEmptyString) ?? []
      );
    }
  }

  return invalidReviewers;
}

function generateUrlFromEndpoint(
  defaultEndpoint: string,
  opts: HostRule,
  repository: string
): string {
  const url = new URL(defaultEndpoint);
  const generatedUrl = git.getUrl({
    protocol: url.protocol as GitProtocol,
    // TODO: types (#7154)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    auth: `${opts.username}:${opts.password}`,
    host: `${url.host}${url.pathname}${
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      url.pathname!.endsWith('/') ? '' : /* istanbul ignore next */ '/'
    }scm`,
    repository,
  });
  logger.debug({ url: generatedUrl }, `using generated endpoint URL`);
  return generatedUrl;
}

function injectAuth(url: string, opts: HostRule): string {
  const repoUrl = parseUrl(url)!;
  if (!repoUrl) {
    logger.debug(`Invalid url: ${url}`);
    throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
  }
  // TODO: null checks (#7154)
  repoUrl.username = opts.username!;
  repoUrl.password = opts.password!;
  return repoUrl.toString();
}

export function getRepoGitUrl(
  repository: string,
  defaultEndpoint: string,
  gitUrl: GitUrlOption | undefined,
  info: BbsRestRepo,
  opts: HostRule
): string {
  if (gitUrl === 'ssh') {
    const sshUrl = info.links.clone?.find(({ name }) => name === 'ssh');
    if (sshUrl === undefined) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    logger.debug({ url: sshUrl.href }, `using ssh URL`);
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
