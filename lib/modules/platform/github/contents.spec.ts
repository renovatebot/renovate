import * as httpMock from '~test/http-mock.ts';
import { GithubHttp } from '../../../util/http/github.ts';
import { toBase64 } from '../../../util/string.ts';
import { getRepoFile } from './contents.ts';

describe('modules/platform/github/contents', () => {
  const apiHost = 'https://api.github.com';
  const http = new GithubHttp();

  it('reads a file and decodes its content', async () => {
    httpMock
      .scope(apiHost)
      .get('/repos/some/repo/contents/renovate.json')
      .reply(200, { content: toBase64('{}') });

    const res = await getRepoFile(http, 'some/repo', 'renovate.json', null, {
      baseUrl: `${apiHost}/`,
    });

    expect(res).toBe('{}');
  });

  it('appends the ref when given', async () => {
    httpMock
      .scope(apiHost)
      .get('/repos/some/repo/contents/renovate.json?ref=dev')
      .reply(200, { content: toBase64('{}') });

    const res = await getRepoFile(http, 'some/repo', 'renovate.json', 'dev', {
      baseUrl: `${apiHost}/`,
    });

    expect(res).toBe('{}');
  });
});
