// SEE for the reference https://github.com/renovatebot/renovate/blob/c3e9e572b225085448d94aa121c7ec81c14d3955/lib/platform/bitbucket/utils.js
import url from 'url';
import api from './bb-got-wrapper';

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp250
const prStateMapping: any = {
  MERGED: 'merged',
  DECLINED: 'closed',
  OPEN: 'open',
};

export function prInfo(pr: any) {
  return {
    version: pr.version,
    number: pr.id,
    body: pr.description,
    branchName: pr.fromRef.displayId,
    title: pr.title,
    state: prStateMapping[pr.state],
    createdAt: pr.createdDate,
    canRebase: false,
  };
}

const addMaxLength = (inputUrl: string, limit = 100) => {
  const { search, ...parsedUrl } = url.parse(inputUrl, true); // eslint-disable-line @typescript-eslint/no-unused-vars
  const maxedUrl = url.format({
    ...parsedUrl,
    query: { ...parsedUrl.query, limit },
  });
  return maxedUrl;
};

export async function accumulateValues(
  reqUrl: string,
  method = 'get',
  options?: any,
  limit?: number
) {
  let accumulator: any = [];
  let nextUrl = addMaxLength(reqUrl, limit);
  const lowerCaseMethod = method.toLocaleLowerCase();

  while (typeof nextUrl !== 'undefined') {
    // TODO: fix typing
    const { body } = await (api as any)[lowerCaseMethod](nextUrl, options);
    accumulator = [...accumulator, ...body.values];
    if (body.isLastPage !== false) break;

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
