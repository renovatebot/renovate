// SEE for the reference https://github.com/renovatebot/renovate/blob/c3e9e572b225085448d94aa121c7ec81c14d3955/lib/platform/bitbucket/utils.js
import url from 'url';
import { PrState } from '../../types';
import { HttpOptions, HttpPostOptions, HttpResponse } from '../../util/http';
import { BitbucketServerHttp } from '../../util/http/bitbucket-server';
import { BbbsRestPr, BbsPr } from './types';

const bitbucketServerHttp = new BitbucketServerHttp();

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp250
const prStateMapping: any = {
  MERGED: PrState.Merged,
  DECLINED: PrState.Closed,
  OPEN: PrState.Open,
};

export function prInfo(pr: BbbsRestPr): BbsPr {
  return {
    version: pr.version,
    number: pr.id,
    body: pr.description,
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
  options?: HttpOptions | HttpPostOptions
): Promise<HttpResponse<T>> {
  /* istanbul ignore next */
  switch (method.toLowerCase()) {
    case 'post':
      return bitbucketServerHttp.postJson<T>(
        apiUrl,
        options as HttpPostOptions
      );
    case 'put':
      return bitbucketServerHttp.putJson<T>(apiUrl, options as HttpPostOptions);
    case 'patch':
      return bitbucketServerHttp.patchJson<T>(
        apiUrl,
        options as HttpPostOptions
      );
    case 'head':
      return bitbucketServerHttp.headJson<T>(apiUrl, options);
    case 'delete':
      return bitbucketServerHttp.deleteJson<T>(
        apiUrl,
        options as HttpPostOptions
      );
    case 'get':
    default:
      return bitbucketServerHttp.getJson<T>(apiUrl, options);
  }
}

export async function accumulateValues<T = any>(
  reqUrl: string,
  method = 'get',
  options?: HttpOptions | HttpPostOptions,
  limit?: number
): Promise<T[]> {
  let accumulator: T[] = [];
  let nextUrl = addMaxLength(reqUrl, limit);

  while (typeof nextUrl !== 'undefined') {
    // TODO: fix typing
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
