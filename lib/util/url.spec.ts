import {
  containsUrlCredentials,
  createURLFromHostOrURL,
  ensurePathPrefix,
  ensureTrailingSlash,
  getQueryString,
  hasUrlCredentials,
  isHttpUrl,
  isUserinfoPlaceholder,
  joinUrlParts,
  massageHostUrl,
  parseLinkHeader,
  parseUrl,
  replaceUrlPath,
  resolveBaseUrl,
  resolveSameOriginUrl,
  stripUrlCredentials,
  trimSlashes,
  trimTrailingSlash,
  withoutUrlCredentials,
} from './url.ts';

describe('util/url', () => {
  it.each`
    baseUrl                 | x                       | result
    ${'http://foo.io'}      | ${''}                   | ${'http://foo.io'}
    ${'http://foo.io/'}     | ${''}                   | ${'http://foo.io'}
    ${'http://foo.io'}      | ${'/'}                  | ${'http://foo.io/'}
    ${'http://foo.io/'}     | ${'/'}                  | ${'http://foo.io/'}
    ${'http://foo.io'}      | ${'/aaa'}               | ${'http://foo.io/aaa'}
    ${'http://foo.io'}      | ${'aaa'}                | ${'http://foo.io/aaa'}
    ${'http://foo.io/'}     | ${'/aaa'}               | ${'http://foo.io/aaa'}
    ${'http://foo.io/'}     | ${'aaa'}                | ${'http://foo.io/aaa'}
    ${'http://foo.io'}      | ${'/aaa/'}              | ${'http://foo.io/aaa/'}
    ${'http://foo.io'}      | ${'aaa/'}               | ${'http://foo.io/aaa/'}
    ${'http://foo.io/'}     | ${'/aaa/'}              | ${'http://foo.io/aaa/'}
    ${'http://foo.io/'}     | ${'aaa/'}               | ${'http://foo.io/aaa/'}
    ${'http://foo.io/aaa'}  | ${'/bbb'}               | ${'http://foo.io/aaa/bbb'}
    ${'http://foo.io/aaa'}  | ${'bbb'}                | ${'http://foo.io/aaa/bbb'}
    ${'http://foo.io/aaa/'} | ${'/bbb'}               | ${'http://foo.io/aaa/bbb'}
    ${'http://foo.io/aaa/'} | ${'bbb'}                | ${'http://foo.io/aaa/bbb'}
    ${'http://foo.io/aaa'}  | ${'/bbb/'}              | ${'http://foo.io/aaa/bbb/'}
    ${'http://foo.io/aaa'}  | ${'bbb/'}               | ${'http://foo.io/aaa/bbb/'}
    ${'http://foo.io/aaa/'} | ${'/bbb/'}              | ${'http://foo.io/aaa/bbb/'}
    ${'http://foo.io/aaa/'} | ${'bbb/'}               | ${'http://foo.io/aaa/bbb/'}
    ${'http://foo.io'}      | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/'}     | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/aaa'}  | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/aaa/'} | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io'}      | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/'}     | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/aaa'}  | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/aaa/'} | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io'}      | ${'aaa?bbb=z'}          | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io'}      | ${'/aaa?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io/'}     | ${'aaa?bbb=z'}          | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io/'}     | ${'/aaa?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io'}      | ${'aaa/?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
  `('$baseUrl + $x => $result', ({ baseUrl, x, result }) => {
    expect(resolveBaseUrl(baseUrl, x)).toBe(result);
  });

  it.each`
    baseUrl                 | x                       | result
    ${'http://foo.io'}      | ${''}                   | ${'http://foo.io'}
    ${'http://foo.io/'}     | ${''}                   | ${'http://foo.io'}
    ${'http://foo.io'}      | ${'/'}                  | ${'http://foo.io/'}
    ${'http://foo.io/'}     | ${'/'}                  | ${'http://foo.io/'}
    ${'http://foo.io'}      | ${'/aaa'}               | ${'http://foo.io/aaa'}
    ${'http://foo.io'}      | ${'aaa'}                | ${'http://foo.io/aaa'}
    ${'http://foo.io/'}     | ${'/aaa'}               | ${'http://foo.io/aaa'}
    ${'http://foo.io/'}     | ${'aaa'}                | ${'http://foo.io/aaa'}
    ${'http://foo.io'}      | ${'/aaa/'}              | ${'http://foo.io/aaa/'}
    ${'http://foo.io'}      | ${'aaa/'}               | ${'http://foo.io/aaa/'}
    ${'http://foo.io/'}     | ${'/aaa/'}              | ${'http://foo.io/aaa/'}
    ${'http://foo.io/'}     | ${'aaa/'}               | ${'http://foo.io/aaa/'}
    ${'http://foo.io/aaa'}  | ${'/bbb'}               | ${'http://foo.io/bbb'}
    ${'http://foo.io/aaa'}  | ${'bbb'}                | ${'http://foo.io/bbb'}
    ${'http://foo.io/aaa/'} | ${'/bbb'}               | ${'http://foo.io/bbb'}
    ${'http://foo.io/aaa/'} | ${'bbb'}                | ${'http://foo.io/bbb'}
    ${'http://foo.io/aaa'}  | ${'/bbb/'}              | ${'http://foo.io/bbb/'}
    ${'http://foo.io/aaa'}  | ${'bbb/'}               | ${'http://foo.io/bbb/'}
    ${'http://foo.io/aaa/'} | ${'/bbb/'}              | ${'http://foo.io/bbb/'}
    ${'http://foo.io/aaa/'} | ${'bbb/'}               | ${'http://foo.io/bbb/'}
    ${'http://foo.io'}      | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/'}     | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/aaa'}  | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/aaa/'} | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io'}      | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/'}     | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/aaa'}  | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/aaa/'} | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io'}      | ${'aaa?bbb=z'}          | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io'}      | ${'/aaa?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io/'}     | ${'aaa?bbb=z'}          | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io/'}     | ${'/aaa?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io'}      | ${'aaa/?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
  `('replaceUrlPath("$baseUrl", "$x") => $result', ({ baseUrl, x, result }) => {
    expect(replaceUrlPath(baseUrl, x)).toBe(result);
    expect(replaceUrlPath(parseUrl(baseUrl)!, x)).toBe(result);
  });

  it('getQueryString', () => {
    expect(getQueryString({ a: 1, b: [1, 2] })).toBe('a=1&b=1&b=2');
  });

  it('validates http-based URLs', () => {
    expect(isHttpUrl(undefined)).toBeFalse();
    expect(isHttpUrl('')).toBeFalse();
    expect(isHttpUrl(null)).toBeFalse();
    expect(isHttpUrl('foo')).toBeFalse();
    expect(isHttpUrl('ssh://github.com')).toBeFalse();
    expect(isHttpUrl('http://github.com')).toBeTrue();
    expect(isHttpUrl('https://github.com')).toBeTrue();
    expect(isHttpUrl(parseUrl('https://github.com')!)).toBeTrue();
  });

  it('parses URL', () => {
    expect(parseUrl(null)).toBeNull();
    expect(parseUrl(undefined)).toBeNull();

    const url = parseUrl('https://github.com/renovatebot/renovate');
    expect(url?.protocol).toBe('https:');
    expect(url?.host).toBe('github.com');
    expect(url?.pathname).toBe('/renovatebot/renovate');
    expect(parseUrl(url)).toBe(url);
  });

  it('trimTrailingSlash', () => {
    expect(trimTrailingSlash('foo')).toBe('foo');
    expect(trimTrailingSlash('/foo/bar')).toBe('/foo/bar');
    expect(trimTrailingSlash('foo/')).toBe('foo');
    expect(trimTrailingSlash('foo//////')).toBe('foo');
  });

  it('trimSlashes', () => {
    expect(trimSlashes('foo')).toBe('foo');
    expect(trimSlashes('/foo')).toBe('foo');
    expect(trimSlashes('foo/')).toBe('foo');
    expect(trimSlashes('//////foo//////')).toBe('foo');
    expect(trimSlashes('foo/bar')).toBe('foo/bar');
    expect(trimSlashes('/foo/bar')).toBe('foo/bar');
    expect(trimSlashes('foo/bar/')).toBe('foo/bar');
    expect(trimSlashes('/foo/bar/')).toBe('foo/bar');
  });

  it('ensureTrailingSlash', () => {
    expect(ensureTrailingSlash('')).toBe('/');
    expect(ensureTrailingSlash('/')).toBe('/');
  });

  it('ensures path prefix', () => {
    expect(ensurePathPrefix('https://index.docker.io', '/v2')).toBe(
      'https://index.docker.io/v2/',
    );
    expect(ensurePathPrefix('https://index.docker.io/v2', '/v2')).toBe(
      'https://index.docker.io/v2',
    );
    expect(
      ensurePathPrefix('https://index.docker.io/v2/something', '/v2'),
    ).toBe('https://index.docker.io/v2/something');
    expect(ensurePathPrefix('https://index.docker.io:443', '/v2')).toBe(
      'https://index.docker.io/v2/',
    );
    expect(
      ensurePathPrefix('https://index.docker.io/something?with=query', '/v2'),
    ).toBe('https://index.docker.io/v2/something?with=query');
  });

  it('joinUrlParts', () => {
    const registryUrl = 'https://some.test';
    expect(joinUrlParts(registryUrl, 'foo')).toBe(`${registryUrl}/foo`);
    expect(joinUrlParts(registryUrl, '/?foo')).toBe(`${registryUrl}?foo`);
    expect(joinUrlParts(registryUrl, '/foo/bar/')).toBe(
      `${registryUrl}/foo/bar/`,
    );
    expect(joinUrlParts(`${registryUrl}/foo/`, '/foo/bar')).toBe(
      `${registryUrl}/foo/foo/bar`,
    );
    expect(joinUrlParts(`${registryUrl}/api/`, '/foo/bar')).toBe(
      `${registryUrl}/api/foo/bar`,
    );
    expect(joinUrlParts('foo//////')).toBe('foo/');
  });

  it('createURLFromHostOrURL', () => {
    expect(createURLFromHostOrURL('https://some.test')).toEqual(
      parseUrl('https://some.test/')!,
    );
    expect(createURLFromHostOrURL('some.test')).toEqual(
      parseUrl('https://some.test/')!,
    );
  });

  it('parseLinkHeader', () => {
    expect(parseLinkHeader(null)).toBeNull();
    expect(parseLinkHeader(' '.repeat(2001))).toBeNull();
    expect(
      parseLinkHeader(
        '<https://api.github.com/user/9287/repos?page=3&per_page=100>; rel="next",' +
          '<https://api.github.com/user/9287/repos?page=1&per_page=100>; rel="prev"; pet="cat", ' +
          '<https://api.github.com/user/9287/repos?page=5&per_page=100>; rel="last"',
      ),
    ).toStrictEqual({
      next: {
        page: '3',
        per_page: '100',
        rel: 'next',
        url: 'https://api.github.com/user/9287/repos?page=3&per_page=100',
      },
      prev: {
        page: '1',
        per_page: '100',
        rel: 'prev',
        pet: 'cat',
        url: 'https://api.github.com/user/9287/repos?page=1&per_page=100',
      },
      last: {
        page: '5',
        per_page: '100',
        rel: 'last',
        url: 'https://api.github.com/user/9287/repos?page=5&per_page=100',
      },
    });
  });

  it('massageHostUrl', () => {
    expect(massageHostUrl('domain.com')).toBe('domain.com');
    expect(massageHostUrl('domain.com:8080')).toBe('https://domain.com:8080');
    expect(massageHostUrl('domain.com/some/path')).toBe(
      'https://domain.com/some/path',
    );
    expect(massageHostUrl('https://domain.com')).toBe('https://domain.com');
  });

  describe('stripUrlCredentials', () => {
    it('removes username and password', () => {
      expect(stripUrlCredentials('https://user:pass@example.com/simple/')).toBe(
        'https://example.com/simple/',
      );
    });

    it('removes a placeholder-style userinfo', () => {
      expect(
        stripUrlCredentials('https://${USER}:${PASS}@example.com/simple/'),
      ).toBe('https://example.com/simple/');
    });

    it('returns the href unchanged when there is no userinfo', () => {
      expect(stripUrlCredentials('https://example.com/simple/')).toBe(
        'https://example.com/simple/',
      );
    });

    it('returns null for an unparseable URL', () => {
      expect(stripUrlCredentials('not-a-url')).toBeNull();
    });

    it('accepts a URL instance without mutating it', () => {
      const url = parseUrl('https://user:pass@example.com/simple/')!;
      expect(stripUrlCredentials(url)).toBe('https://example.com/simple/');
      expect(url.username).toBe('user');
      expect(url.password).toBe('pass');
    });
  });

  describe('hasUrlCredentials', () => {
    it.each`
      text                                                           | expected
      ${'https://user:token@example.com/simple/'}                    | ${true}
      ${'registry = "HTTPS://user:token@example.com"'}               | ${true}
      ${'git+https://ghp_0123456789abcdef@github.com/org/repo.git'}  | ${true}
      ${'git+https://ghp_token@github.com/org/repo.git#v1.0.0'}      | ${false}
      ${'https://jdoe@bitbucket.org/acme/lib.git'}                   | ${false}
      ${'git+https://git@gitlab.com/grp/repo.git'}                   | ${false}
      ${'https://abcdefghijklmnop@example.com/'}                     | ${true}
      ${'https://abcdefghijklmno@example.com/'}                      | ${false}
      ${'https://jdoe:x@bitbucket.org/acme/lib.git'}                 | ${true}
      ${'https://x-access-token:secret@github.com/org/repo'}         | ${true}
      ${'git::https://user:p%40ss@example.com/mod.git?ref=v1'}       | ${true}
      ${'ssh://git:secret@example.com/org/repo.git'}                 | ${true}
      ${'https://example.com/ https://user:token@example.com/'}      | ${true}
      ${'https://example.com/simple/'}                               | ${false}
      ${'https://registry.example.com/@scope/pkg'}                   | ${false}
      ${'https://${USER}:${TOKEN}@example.com/simple/'}              | ${false}
      ${'https://user:${TOKEN}@example.com/simple/'}                 | ${false}
      ${'https://{{ username }}:{{ password }}@example.com/simple/'} | ${false}
      ${'https://$%7BUSER%7D:$%7BTOKEN%7D@example.com/simple/'}      | ${false}
      ${'https://{{token}}@example.com/simple/'}                     | ${false}
      ${'https://${TOKEN}@example.com/simple/'}                      | ${false}
      ${'https://$USER:$PASS@example.com/simple/'}                   | ${false}
      ${'https://user:$PASS@example.com/simple/'}                    | ${false}
      ${'https://user:$Pass@example.com/simple/'}                    | ${true}
      ${'https://$TOKEN@example.com/simple/'}                        | ${false}
      ${'https://$TOKEN_0123456789AB@example.com/simple/'}           | ${false}
      ${'https://$token_0123456789ab@example.com/simple/'}           | ${true}
      ${'https://user:$ecret@example.com/simple/'}                   | ${true}
      ${'https://user:pre${X}@example.com/simple/'}                  | ${true}
      ${'https://user:${PASS@example.com/simple/'}                   | ${true}
      ${'https://user:${PASS}x@example.com/simple/'}                 | ${true}
      ${'https://user:${PRE}${PASS}@example.com/simple/'}            | ${true}
      ${'https://${USER}${SUFFIX}:${PASS}@example.com/simple/'}      | ${false}
      ${'https://user:pa:ss@example.com/simple/'}                    | ${true}
      ${'https://user:${PASS}:x@example.com/simple/'}                | ${true}
      ${'https://{{token}}x@example.com/simple/'}                    | ${false}
      ${'https://{{token}}0123456789@example.com/simple/'}           | ${true}
      ${'https://us%20er:pa%20ss@example.com/simple/'}               | ${true}
      ${'https://us er:pa ss@example.com/simple/'}                   | ${false}
      ${'https://user:p4$$word@example.com/simple/'}                 | ${true}
      ${'https://$@example.com/simple/'}                             | ${false}
      ${'https://%E0%A4%A@example.com/'}                             | ${false}
      ${'https://%E0%A4%Azzzzzzzzz@example.com/'}                    | ${true}
      ${'https://token:@example.com/'}                               | ${false}
      ${'https://abcdefghijklmnop:@example.com/'}                    | ${true}
      ${'https://:@example.com/'}                                    | ${false}
      ${'https://oauth2accesstoken@region-python.pkg.dev/p/simple/'} | ${false}
      ${'https://oauth2accesstoken:@region-docker.pkg.dev/p/'}       | ${false}
      ${'https://oauth2accesstoken:secret@region-docker.pkg.dev/p/'} | ${true}
      ${'https://myorg@dev.azure.com/myorg/proj/_git/mod'}           | ${false}
      ${'https://MyOrg@dev.azure.com/myorg/proj/_git/mod'}           | ${false}
      ${'git+https://user@bitbucket.org/user/repo.git'}              | ${false}
      ${'git::https://user@bitbucket.org/user/repo.git?ref=v1'}      | ${false}
      ${'https://ghp_0123456789abcdef@github.com/org/repo'}          | ${true}
      ${'https://myorg:secret@dev.azure.com/myorg/proj/_git/mod'}    | ${true}
      ${'https://token@example.com'}                                 | ${false}
      ${'https://abcdefghijklmnop@example.com'}                      | ${true}
      ${'https://abcdefghijklmnop@dev.azure.com/abcdefghijklmnop/p'} | ${false}
      ${'ssh://git:@github.com/org/repo.git'}                        | ${false}
      ${'ssh://git@github.com/org/repo.git'}                         | ${false}
      ${'git+ssh://git@github.com/org/repo.git'}                     | ${false}
      ${'docker://alpine:3.18@sha256:abcdef'}                        | ${false}
      ${'git@github.com:org/repo.git'}                               | ${false}
      ${'user@example.com'}                                          | ${false}
    `('returns $expected for $text', ({ text, expected }) => {
      expect(hasUrlCredentials(text)).toBe(expected);
    });
  });

  describe('isUserinfoPlaceholder', () => {
    it.each`
      value                                         | expected
      ${'${USER}'}                                  | ${true}
      ${'$%7BUSER%7D'}                              | ${true}
      ${'{{ user }}'}                               | ${true}
      ${'{{user}}'}                                 | ${true}
      ${'%7B%7B%20user%20%7D%7D'}                   | ${true}
      ${'${{ secrets.TOKEN }}'}                     | ${true}
      ${'${{secrets.TOKEN}}'}                       | ${true}
      ${'%24%7B%7B%20secrets.TOKEN%20%7D%7D'}       | ${true}
      ${'${env.TOKEN}'}                             | ${true}
      ${'%24%7Benv.TOKEN%7D'}                       | ${true}
      ${'${TOKEN:?missing token}'}                  | ${true}
      ${'%24%7BTOKEN%3A%3Fmissing%20token%7D'}      | ${true}
      ${'${TOKEN?missing}'}                         | ${true}
      ${'%24%7BTOKEN%3Fmissing%7D'}                 | ${true}
      ${'$USER'}                                    | ${true}
      ${'$NPM_TOKEN_2'}                             | ${true}
      ${'%24USER'}                                  | ${true}
      ${'${USER'}                                   | ${false}
      ${'${USER}x'}                                 | ${false}
      ${'${NAME}extra'}                             | ${false}
      ${'pre${USER}'}                               | ${false}
      ${'${USER}${PASS}'}                           | ${false}
      ${'${}'}                                      | ${false}
      ${'${1USER}'}                                 | ${false}
      ${'{{user}}x'}                                | ${false}
      ${'{{ user.name }}'}                          | ${false}
      ${'${{ }}'}                                   | ${false}
      ${'${{ secrets.TOKEN }}x'}                    | ${false}
      ${'${{ secrets.TOKEN }}${{ secrets.OTHER }}'} | ${false}
      ${'%24%7B%7B%20secrets.TOKEN%20%7D%7Dx'}      | ${false}
      ${'${env.}'}                                  | ${false}
      ${'${env.TOKEN}x'}                            | ${false}
      ${'%24%7Benv.1TOKEN%7D'}                      | ${false}
      ${'${TOKEN:-default}'}                        | ${false}
      ${'${TOKEN-default}'}                         | ${false}
      ${'${TOKEN:=default}'}                        | ${false}
      ${'%24%7BTOKEN%3A-default%7D'}                | ${false}
      ${'${TOKEN:?missing}x'}                       | ${false}
      ${'%24%7BTOKEN%3F%7Bmissing%7D%7D'}           | ${false}
      ${'$USER$PASS'}                               | ${false}
      ${'$USERx$'}                                  | ${false}
      ${'$user'}                                    | ${false}
      ${'$User'}                                    | ${false}
      ${'$ecret'}                                   | ${false}
      ${'%24ecret'}                                 | ${false}
      ${'$1ABC'}                                    | ${false}
      ${'$1abc'}                                    | ${false}
      ${'%241ABC'}                                  | ${false}
      ${'user'}                                     | ${false}
      ${'p4$$word'}                                 | ${false}
      ${'pa$$word'}                                 | ${false}
      ${'$'}                                        | ${false}
      ${'%24'}                                      | ${false}
      ${''}                                         | ${false}
    `('returns $expected for $value', ({ value, expected }) => {
      expect(isUserinfoPlaceholder(value)).toBe(expected);
    });
  });

  describe('containsUrlCredentials', () => {
    it.each`
      value                                                                     | expected
      ${'https://user:token@example.com/'}                                      | ${true}
      ${['https://example.com/', 'https://user:token@example.com/']}            | ${true}
      ${{ deps: [{ managerData: { url: 'https://user:token@example.com' } }] }} | ${true}
      ${{ deps: [{ registryUrls: ['https://example.com/'], lineNumber: 1 }] }}  | ${false}
      ${{ deps: [{ depName: 'https://myorg@dev.azure.com/myorg/p/_git/m' }] }}  | ${false}
      ${null}                                                                   | ${false}
      ${42}                                                                     | ${false}
    `('returns $expected for $value', ({ value, expected }) => {
      expect(containsUrlCredentials(value)).toBe(expected);
    });
  });

  describe('withoutUrlCredentials', () => {
    it.each`
      text                                                                     | expected
      ${'getReleases:https://user:pass@host/x'}                                | ${'getReleases:https://host/x'}
      ${'git+https://token@git.example.com/org/repo.git#v1'}                   | ${'git+https://token@git.example.com/org/repo.git#v1'}
      ${'git+https://glpat-0123456789abcdef@git.example.com/org/repo.git#v1'}  | ${'git+https://git.example.com/org/repo.git#v1'}
      ${'git+ssh://git@github.com/org/repo'}                                   | ${'git+ssh://git@github.com/org/repo'}
      ${'https://oauth2accesstoken@host/'}                                     | ${'https://oauth2accesstoken@host/'}
      ${'https://myorg@dev.azure.com/myorg/proj/_git/mod'}                     | ${'https://myorg@dev.azure.com/myorg/proj/_git/mod'}
      ${'git+https://ghp_0123456789abcdef@github.com/org/repo'}                | ${'git+https://github.com/org/repo'}
      ${'https://myorg:secret@dev.azure.com/myorg/proj/_git/mod'}              | ${'https://dev.azure.com/myorg/proj/_git/mod'}
      ${'x https://a@h/b https://user@h/user/r https://tok@h/org'}             | ${'x https://a@h/b https://user@h/user/r https://tok@h/org'}
      ${'x https://abcdefghijklmnop@h/b https://abcdefghijklmnopq@h/org'}      | ${'x https://h/b https://h/org'}
      ${'https://${USER}:${PASS}@host/'}                                       | ${'https://${USER}:${PASS}@host/'}
      ${'https://{{user}}:{{pass}}@host/'}                                     | ${'https://{{user}}:{{pass}}@host/'}
      ${'https://$USER:$PASS@host/'}                                           | ${'https://$USER:$PASS@host/'}
      ${'https://user:$ecret@host/'}                                           | ${'https://host/'}
      ${'https://user:${{secrets.TOKEN}}@host/'}                               | ${'https://user:${{secrets.TOKEN}}@host/'}
      ${'https://user:${env.TOKEN}@host/'}                                     | ${'https://user:${env.TOKEN}@host/'}
      ${'https://user:%24%7BTOKEN%3A%3Funset%7D@host/'}                        | ${'https://user:%24%7BTOKEN%3A%3Funset%7D@host/'}
      ${'https://user:${TOKEN:-secret}@host/'}                                 | ${'https://host/'}
      ${'https://user:pre${PASS}@host/'}                                       | ${'https://host/'}
      ${'https://user:${PRE}${PASS}@host/'}                                    | ${'https://host/'}
      ${'https://us%20er:pa%20ss@host/'}                                       | ${'https://host/'}
      ${'https://us er:pa ss@host/'}                                           | ${'https://us er:pa ss@host/'}
      ${'no url in here at all'}                                               | ${'no url in here at all'}
      ${'https://user:pass@a.example.com/ https://user2:pass2@b.example.com/'} | ${'https://a.example.com/ https://b.example.com/'}
    `('returns $expected for $text', ({ text, expected }) => {
      expect(withoutUrlCredentials(text)).toBe(expected);
    });
  });

  describe('resolveSameOriginUrl', () => {
    it('resolves a same-origin absolute URL', () => {
      expect(
        resolveSameOriginUrl(
          'https://registry.example.com/v2/foo/tags/list?n=10',
          'https://registry.example.com/v2/foo/tags/list?n=10&last=z',
        ),
      ).toBe('https://registry.example.com/v2/foo/tags/list?n=10&last=z');
    });

    it('upgrades an HTTP URL to HTTPS when the host is the same', () => {
      expect(
        resolveSameOriginUrl(
          'https://community.chocolatey.org/api/v2/FindPackagesById',
          'http://community.chocolatey.org/api/v2/FindPackagesById?page=2',
        ),
      ).toBe('https://community.chocolatey.org/api/v2/FindPackagesById?page=2');
    });

    it('does not upgrade HTTP to HTTPS when the next URL has a non-standard port', () => {
      expect(
        resolveSameOriginUrl(
          'https://community.chocolatey.org/api/v2/FindPackagesById',
          'http://community.chocolatey.org:8080/api/v2/FindPackagesById?page=2',
        ),
      ).toBeNull();
    });

    it('rejects a different port on the same host', () => {
      expect(
        resolveSameOriginUrl(
          'https://registry.example.com:8443/v2/foo',
          'https://registry.example.com/v2/foo?page=2',
        ),
      ).toBeNull();
    });

    it('resolves a relative next URL against the base', () => {
      expect(
        resolveSameOriginUrl(
          'https://registry.example.com/v2/foo/tags/list?n=10',
          '/v2/foo/tags/list?n=10&last=z',
        ),
      ).toBe('https://registry.example.com/v2/foo/tags/list?n=10&last=z');
    });

    it('rejects a cross-origin next URL', () => {
      expect(
        resolveSameOriginUrl(
          'https://registry.example.com/v2/foo/tags/list?n=10',
          'https://attacker.example.com/v2/steal/tags/list',
        ),
      ).toBeNull();
    });

    it('rejects when the base URL is invalid', () => {
      expect(
        resolveSameOriginUrl('not a url', 'https://registry.example.com/next'),
      ).toBeNull();
    });

    it('rejects when the next URL is invalid', () => {
      expect(
        resolveSameOriginUrl('https://registry.example.com/v2/', 'http://'),
      ).toBeNull();
    });

    it('accepts a URL instance as the base', () => {
      expect(
        resolveSameOriginUrl(
          parseUrl('https://registry.example.com/v2/foo?n=10')!,
          'https://registry.example.com/v2/foo?n=10&page=2',
        ),
      ).toBe('https://registry.example.com/v2/foo?n=10&page=2');
    });
  });
});
