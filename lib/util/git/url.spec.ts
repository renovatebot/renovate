import { hostRules } from '../../../test/util';
import { getHttpUrl, getRemoteUrlWithToken } from './url';

jest.mock('../host-rules');

describe('util/git/url', () => {
  describe('getHttpUrl()', () => {
    it('returns https url for git url', () => {
      expect(getHttpUrl('git://foo.bar/')).toBe('https://foo.bar/');
    });

    it('returns https url for https url', () => {
      expect(getHttpUrl('https://foo.bar/')).toBe('https://foo.bar/');
    });

    it('returns http url for http url', () => {
      expect(getHttpUrl('http://foo.bar/')).toBe('http://foo.bar/');
    });
  });

  describe('getRemoteUrlWithToken()', () => {
    it('returns original url if no host rule is found', () => {
      expect(getRemoteUrlWithToken('https://foo.bar/')).toBe(
        'https://foo.bar/'
      );
    });

    it('returns http url with token', () => {
      hostRules.find.mockReturnValueOnce({ token: 'token' });
      expect(getRemoteUrlWithToken('http://foo.bar/')).toBe(
        'http://token@foo.bar/'
      );
    });

    it('returns https url with token', () => {
      hostRules.find.mockReturnValueOnce({ token: 'token' });
      expect(getRemoteUrlWithToken('https://foo.bar/')).toBe(
        'https://token@foo.bar/'
      );
    });

    it('returns https url with token for non-http protocols', () => {
      hostRules.find.mockReturnValueOnce({ token: 'token' });
      expect(getRemoteUrlWithToken('ssh://foo.bar/')).toBe(
        'https://token@foo.bar/'
      );
    });

    it('returns https url with encoded token', () => {
      hostRules.find.mockReturnValueOnce({ token: 't#ken' });
      expect(getRemoteUrlWithToken('https://foo.bar/')).toBe(
        'https://t%23ken@foo.bar/'
      );
    });

    it('returns http url with username and password', () => {
      hostRules.find.mockReturnValueOnce({
        username: 'user',
        password: 'pass',
      });
      expect(getRemoteUrlWithToken('http://foo.bar/')).toBe(
        'http://user:pass@foo.bar/'
      );
    });

    it('returns https url with username and password', () => {
      hostRules.find.mockReturnValueOnce({
        username: 'user',
        password: 'pass',
      });
      expect(getRemoteUrlWithToken('https://foo.bar/')).toBe(
        'https://user:pass@foo.bar/'
      );
    });

    it('returns https url with username and password for non-http protocols', () => {
      hostRules.find.mockReturnValueOnce({
        username: 'user',
        password: 'pass',
      });
      expect(getRemoteUrlWithToken('ssh://foo.bar/')).toBe(
        'https://user:pass@foo.bar/'
      );
    });

    it('returns https url with encoded username and password', () => {
      hostRules.find.mockReturnValueOnce({
        username: 'u$er',
        password: 'p@ss',
      });
      expect(getRemoteUrlWithToken('https://foo.bar/')).toBe(
        'https://u%24er:p%40ss@foo.bar/'
      );
    });
  });
});
