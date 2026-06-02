import { Readable } from 'node:stream';
import { streamToString } from '../../../util/streams.ts';
import {
  getBranchNameWithoutRefsheadsPrefix,
  getGitStatusContextCombinedName,
  getGitStatusContextFromCombinedName,
  getProjectAndRepo,
  getRenovatePRFormat,
  getRepoByName,
  getStorageExtraCloneOpts,
  isProbablyJwt,
  max4000Chars,
} from './util.ts';

describe('modules/platform/azure/util', () => {
  describe('getGitStatusContextCombinedName', () => {
    it('should return undefined if null context passed', () => {
      const contextName = getGitStatusContextCombinedName(null);
      expect(contextName).toBeUndefined();
    });

    it('should combine valid genre and name with slash', () => {
      const contextName = getGitStatusContextCombinedName({
        genre: 'my-genre',
        name: 'status-name',
      });
      expect(contextName).toMatch('my-genre/status-name');
    });

    it('should combine valid empty genre and name without a slash', () => {
      const contextName = getGitStatusContextCombinedName({
        genre: undefined,
        name: 'status-name',
      });
      expect(contextName).toMatch('status-name');
    });
  });

  describe('getGitStatusContextFromCombinedName', () => {
    it('should return undefined if null context passed', () => {
      const context = getGitStatusContextFromCombinedName(null);
      expect(context).toBeUndefined();
    });

    it('should parse valid genre and name with slash', () => {
      const context = getGitStatusContextFromCombinedName(
        'my-genre/status-name',
      );
      expect(context).toEqual({
        genre: 'my-genre',
        name: 'status-name',
      });
    });

    it('should parse valid genre and name with multiple slashes', () => {
      const context = getGitStatusContextFromCombinedName(
        'my-genre/sub-genre/status-name',
      );
      expect(context).toEqual({
        genre: 'my-genre/sub-genre',
        name: 'status-name',
      });
    });

    it('should parse valid empty genre and name without a slash', () => {
      const context = getGitStatusContextFromCombinedName('status-name');
      expect(context).toEqual({
        genre: undefined,
        name: 'status-name',
      });
    });
  });

  describe('getBranchNameWithoutRefsheadsPrefix', () => {
    it('should be renamed', () => {
      const res = getBranchNameWithoutRefsheadsPrefix('refs/heads/testBB');
      expect(res).toBe(`testBB`);
    });

    it('should log error and return undefined', () => {
      const res = getBranchNameWithoutRefsheadsPrefix(undefined as any);
      expect(res).toBeUndefined();
    });

    it('should return the input', () => {
      const res = getBranchNameWithoutRefsheadsPrefix('testBB');
      expect(res).toBe('testBB');
    });
  });

  describe('getRenovatePRFormat', () => {
    it('should be formated (closed)', () => {
      const res = getRenovatePRFormat({ status: 2 } as any);
      expect(res).toMatchSnapshot();
    });

    it('should be formated (closed v2)', () => {
      const res = getRenovatePRFormat({ status: 3 } as any);
      expect(res).toMatchSnapshot();
    });

    it('should be formated (not closed)', () => {
      const res = getRenovatePRFormat({ status: 1 } as any);
      expect(res).toMatchSnapshot();
    });
  });

  describe('streamToString', () => {
    it('converts Readable stream to string', async () => {
      const res = await streamToString(Readable.from('foobar'));
      expect(res).toBe('foobar');
    });

    it('handles error', async () => {
      const stream = Readable.from('foobar');
      const res = streamToString(stream);
      stream.destroy(new Error('some unknown error'));
      await expect(res).rejects.toThrow('some unknown error');
    });
  });

  describe('isProbablyJwt', () => {
    it('returns true for a valid JWT with typ and alg', () => {
      const header = Buffer.from(
        JSON.stringify({ typ: 'JWT', alg: 'RS256' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ aud: '499b84ac', sub: 'test' }),
      ).toString('base64url');
      const sig = Buffer.from('fake-sig').toString('base64url');
      expect(isProbablyJwt(`${header}.${payload}.${sig}`)).toBeTrue();
    });

    it('returns true for a JWT with only alg in header', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
        'base64url',
      );
      const payload = Buffer.from(JSON.stringify({ sub: 'x' })).toString(
        'base64url',
      );
      const sig = Buffer.from('sig').toString('base64url');
      expect(isProbablyJwt(`${header}.${payload}.${sig}`)).toBeTrue();
    });

    it('returns false for a 52-char PAT', () => {
      expect(isProbablyJwt('a'.repeat(52))).toBeFalse();
    });

    it('returns false for an empty string', () => {
      expect(isProbablyJwt('')).toBeFalse();
    });

    it('returns false for invalid base64 segments', () => {
      expect(isProbablyJwt('not.valid.base64!!!')).toBeFalse();
    });

    it('returns false when header JSON has no typ or alg', () => {
      const header = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
        'base64url',
      );
      const payload = Buffer.from(JSON.stringify({ sub: 'x' })).toString(
        'base64url',
      );
      const sig = Buffer.from('sig').toString('base64url');
      expect(isProbablyJwt(`${header}.${payload}.${sig}`)).toBeFalse();
    });

    it('returns false for two segments', () => {
      const seg = Buffer.from(
        JSON.stringify({ typ: 'JWT', alg: 'RS256' }),
      ).toString('base64url');
      expect(isProbablyJwt(`${seg}.${seg}`)).toBeFalse();
    });

    it('returns false for four segments', () => {
      const seg = Buffer.from(
        JSON.stringify({ typ: 'JWT', alg: 'RS256' }),
      ).toString('base64url');
      expect(isProbablyJwt(`${seg}.${seg}.${seg}.${seg}`)).toBeFalse();
    });

    it('returns false when header decodes to a non-object', () => {
      const header = Buffer.from('"just a string"').toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'x' })).toString(
        'base64url',
      );
      const sig = Buffer.from('sig').toString('base64url');
      expect(isProbablyJwt(`${header}.${payload}.${sig}`)).toBeFalse();
    });

    it('returns false when header decodes to null', () => {
      const header = Buffer.from('null').toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'x' })).toString(
        'base64url',
      );
      const sig = Buffer.from('sig').toString('base64url');
      expect(isProbablyJwt(`${header}.${payload}.${sig}`)).toBeFalse();
    });
  });

  describe('getStorageExtraCloneOpts', () => {
    it('should configure basic auth', () => {
      const res = getStorageExtraCloneOpts({
        username: 'user',
        password: 'pass',
      });
      expect(res).toMatchSnapshot();
    });

    it('should configure personal access token', () => {
      const res = getStorageExtraCloneOpts({
        token: '123456789012345678901234567890123456789012345678test',
      });
      expect(res).toMatchSnapshot();
    });

    it('should configure non-JWT token as PAT', () => {
      const res = getStorageExtraCloneOpts({ token: 'token' });
      expect(res['-c']).toContain('AUTHORIZATION: basic');
    });

    it('should use bearer when token is a JWT', () => {
      const header = Buffer.from(
        JSON.stringify({ typ: 'JWT', alg: 'RS256' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ aud: '499b84ac', sub: 'test', exp: 9999999999 }),
      ).toString('base64url');
      const sig = Buffer.from('fake-sig').toString('base64url');
      const jwt = `${header}.${payload}.${sig}`;
      const res = getStorageExtraCloneOpts({ token: jwt });
      expect(res['-c']).toContain('AUTHORIZATION: bearer');
      expect(res['-c']).toContain(jwt);
    });

    it('should use basic for a 52-char PAT', () => {
      const token = '1234567890123456789012345678901234567890123456789012';
      const res = getStorageExtraCloneOpts({ token });
      expect(res['-c']).toContain('AUTHORIZATION: basic');
      expect(res['-c']).not.toContain('bearer');
    });

    it('should use basic for a short opaque token', () => {
      const res = getStorageExtraCloneOpts({ token: 'short-token' });
      expect(res['-c']).toContain('AUTHORIZATION: basic');
      expect(res['-c']).not.toContain('bearer');
    });

    it('should use basic for an invalid JWT-like token', () => {
      const res = getStorageExtraCloneOpts({ token: 'not.valid.jwt' });
      expect(res['-c']).toContain('AUTHORIZATION: basic');
      expect(res['-c']).not.toContain('bearer');
    });
  });

  describe('max4000Chars', () => {
    it('should be the same', () => {
      const res = max4000Chars('Hello');
      expect(res).toMatchSnapshot();
    });

    it('should be truncated', () => {
      let str = '';
      for (let i = 0; i < 5000; i += 1) {
        str += 'a';
      }
      const res = max4000Chars(str);
      expect(res).toHaveLength(3999);
    });
  });

  describe('getProjectAndRepo', () => {
    it('should return the object with same strings', () => {
      const res = getProjectAndRepo('myRepoName');
      expect(res).toMatchSnapshot();
    });

    it('should return the object with project and repo', () => {
      const res = getProjectAndRepo('prjName/myRepoName');
      expect(res).toMatchSnapshot();
    });

    it('should return an error', () => {
      expect(() => getProjectAndRepo('prjName/myRepoName/blalba')).toThrow(
        Error(
          `Azure repository can be only structured this way : 'repository' or 'projectName/repository'!`,
        ),
      );
    });
  });

  describe('getRepoByName', () => {
    it('returns null when repos array is empty', () => {
      expect(getRepoByName('foo/bar', [])).toBeNull();
      expect(getRepoByName('foo/bar', undefined)).toBeNull();
      expect(getRepoByName('foo/bar', null)).toBeNull();
    });

    it('returns null when repo is not found', () => {
      expect(
        getRepoByName('foo/foo', [{ name: 'bar', project: { name: 'bar' } }]),
      ).toBeNull();
    });

    it('finds repo', () => {
      expect(
        getRepoByName('foo/bar', [
          { id: '1', name: 'baz', project: { name: 'qux' } },
          null,
          undefined,
          { id: '2', name: 'bar' },
          { id: '3', name: 'bar', project: { name: 'foo' } },
          { id: '4', name: 'bar', project: { name: 'foo' } },
        ]),
      ).toMatchObject({ id: '3' });
    });

    it('supports shorthand names', () => {
      expect(
        getRepoByName('foo', [
          { id: '1', name: 'bar', project: { name: 'bar' } },
          { id: '2', name: 'foo', project: { name: 'foo' } },
        ]),
      ).toMatchObject({ id: '2' });
    });

    it('is case-independent', () => {
      const repos = [
        { id: '1', name: 'FOO', project: { name: 'FOO' } },
        { id: '2', name: 'foo', project: { name: 'foo' } },
      ];
      expect(getRepoByName('FOO/foo', repos)).toMatchObject({ id: '1' });
      expect(getRepoByName('foo/FOO', repos)).toMatchObject({ id: '1' });
      expect(getRepoByName('foo/foo', repos)).toMatchObject({ id: '1' });
    });

    it('throws when repo name is invalid', () => {
      // TODO: better error handling #22198
      expect(() => getRepoByName(undefined as never, [])).toThrow();
      expect(() => getRepoByName(null as never, [])).toThrow();
      expect(() => getRepoByName('foo/bar/baz', [])).toThrow();
    });
  });
});
