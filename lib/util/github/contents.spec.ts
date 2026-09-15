import * as httpMock from '~test/http-mock.ts';
import { GithubHttp } from '../http/github.ts';
import { toBase64 } from '../string.ts';
import { getRepoFile } from './contents.ts';

describe('util/github/contents', () => {
  const apiHost = 'https://api.github.com';
  const http = new GithubHttp();

  it('reads a file and decodes its content', async () => {
    httpMock
      .scope(apiHost)
      .get('/repos/some/repo/contents/renovate.json')
      .reply(200, { content: toBase64('{}') });

    const res = await getRepoFile(
      http,
      `${apiHost}/`,
      'some/repo',
      'renovate.json',
    );

    expect(res).toBe('{}');
  });

  it('appends the ref when given', async () => {
    httpMock
      .scope(apiHost)
      .get('/repos/some/repo/contents/renovate.json?ref=dev')
      .reply(200, { content: toBase64('{}') });

    const res = await getRepoFile(
      http,
      `${apiHost}/`,
      'some/repo',
      'renovate.json',
      'dev',
    );

    expect(res).toBe('{}');
  });
});
