import * as httpMock from '~test/http-mock.ts';
import { GithubHttp } from '../http/github.ts';
import { containsCommit } from './compare.ts';

describe('util/github/compare', () => {
  const http = new GithubHttp();

  it.each`
    status         | expected
    ${'ahead'}     | ${true}
    ${'identical'} | ${true}
    ${'behind'}    | ${false}
    ${'diverged'}  | ${false}
  `('returns $expected when head is $status', async ({ status, expected }) => {
    httpMock
      .scope('https://api.github.com')
      .get('/repos/foo/bar/compare/abc123...def456')
      .reply(200, { status });

    const res = await containsCommit(
      http,
      undefined,
      'foo/bar',
      'abc123',
      'def456',
    );

    expect(res).toBe(expected);
  });

  it('uses the API of the registry', async () => {
    httpMock
      .scope('https://github.example.com')
      .get('/api/v3/repos/foo/bar/compare/abc123...def456')
      .reply(200, { status: 'ahead' });

    const res = await containsCommit(
      http,
      'https://github.example.com',
      'foo/bar',
      'abc123',
      'def456',
    );

    expect(res).toBeTrue();
  });
});
