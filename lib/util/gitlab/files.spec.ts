import * as httpMock from '~test/http-mock.ts';
import { GitlabHttp } from '../http/gitlab.ts';
import { toBase64 } from '../string.ts';
import { getRepoFile } from './files.ts';

describe('util/gitlab/files', () => {
  const apiHost = 'https://gitlab.com';
  const apiBaseUrl = `${apiHost}/api/v4/`;
  const http = new GitlabHttp();

  it('defaults the ref to HEAD', async () => {
    httpMock
      .scope(apiHost)
      .get(
        '/api/v4/projects/some%2Frepo/repository/files/renovate.json?ref=HEAD',
      )
      .reply(200, { content: toBase64('{}') });

    const res = await getRepoFile(
      http,
      apiBaseUrl,
      'some%2Frepo',
      'renovate.json',
    );

    expect(res).toBe('{}');
  });

  it('escapes the file name and uses the given ref', async () => {
    httpMock
      .scope(apiHost)
      .get(
        `/api/v4/projects/some%2Frepo/repository/files/${encodeURIComponent('.github/renovate.json')}?ref=dev`,
      )
      .reply(200, { content: toBase64('{}') });

    const res = await getRepoFile(
      http,
      apiBaseUrl,
      'some%2Frepo',
      '.github/renovate.json',
      'dev',
    );

    expect(res).toBe('{}');
  });
});
