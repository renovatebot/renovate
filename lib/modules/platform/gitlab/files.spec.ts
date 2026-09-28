import * as httpMock from '~test/http-mock.ts';
import { GitlabHttp, setBaseUrl } from '../../../util/http/gitlab.ts';
import { toBase64 } from '../../../util/string.ts';
import { getRepoFile } from './files.ts';

describe('modules/platform/gitlab/files', () => {
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

    const res = await getRepoFile(http, 'some%2Frepo', 'renovate.json', null, {
      baseUrl: apiBaseUrl,
    });

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
      'some%2Frepo',
      '.github/renovate.json',
      'dev',
      { baseUrl: apiBaseUrl },
    );

    expect(res).toBe('{}');
  });

  it('falls back to the client base url', async () => {
    setBaseUrl('https://gl.example.com/api/v4/');
    httpMock
      .scope('https://gl.example.com')
      .get(
        '/api/v4/projects/some%2Frepo/repository/files/renovate.json?ref=HEAD',
      )
      .reply(200, { content: toBase64('{}') });

    const res = await getRepoFile(http, 'some%2Frepo', 'renovate.json');

    expect(res).toBe('{}');
  });
});
