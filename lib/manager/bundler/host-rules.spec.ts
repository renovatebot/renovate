import { getName } from '../../../test/util';
import { HostRule } from '../../types';
import { add, clear } from '../../util/host-rules';

import {
  findAllAuthenticatable,
  getAuthenticationHeaderValue,
  getDomain,
} from './host-rules';

describe(getName(__filename), () => {
  beforeEach(() => {
    clear();
  });
  describe('getDomain()', () => {
    it('returns the hostName if hostName is present', () => {
      expect(
        getDomain({
          hostName: 'api.github.com',
        })
      ).toEqual('api.github.com');
    });
    it('returns the domainName if domainName is present and hostName is not present', () => {
      expect(
        getDomain({
          domainName: 'github.com',
        })
      ).toEqual('github.com');
    });
    it('returns the hostName if hostName and domainName are present', () => {
      expect(
        getDomain({
          hostName: 'api.github.com',
          domainName: 'github.com',
        })
      ).toEqual('api.github.com');
    });
    it('returns the baseUrl host if hostName and domainName are not present', () => {
      expect(
        getDomain({
          baseUrl: 'https://github.com',
        })
      ).toEqual('github.com');
    });
    it('returns undefined if hostName, domainName and baseUrl are not present', () => {
      expect(getDomain({})).toBeNull();
    });
  });
  describe('getAuthenticationHeaderValue()', () => {
    it('returns the authentication header with the password', () => {
      expect(
        getAuthenticationHeaderValue({
          username: 'test',
          password: 'password',
        })
      ).toEqual('test:password');
    });
    it('returns the authentication header with the token', () => {
      expect(
        getAuthenticationHeaderValue({
          token: 'token',
        })
      ).toEqual('token');
    });
  });
  describe('findAllAuthenticatable()', () => {
    let hostRule: HostRule;

    beforeEach(() => {
      hostRule = {
        hostType: 'nuget',
        hostName: 'nuget.org',
        domainName: 'api.nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
        token: 'token',
      };
    });
    it('returns an empty array if domainName, hostName and baseUrl are missing', () => {
      delete hostRule.hostName;
      delete hostRule.domainName;

      add(hostRule);
      expect(findAllAuthenticatable({ hostType: 'nuget' } as any)).toEqual([]);
    });
    it('returns an empty array if username is missing and password is present', () => {
      delete hostRule.domainName;
      delete hostRule.username;
      delete hostRule.password;
      delete hostRule.token;

      add(hostRule);
      expect(findAllAuthenticatable({ hostType: 'nuget' } as any)).toEqual([]);
    });
    it('returns an empty array if password and token are missing', () => {
      delete hostRule.domainName;
      delete hostRule.password;
      delete hostRule.token;

      add(hostRule);
      expect(findAllAuthenticatable({ hostType: 'nuget' } as any)).toEqual([]);
    });
    it('returns the hostRule if using hostName and password', () => {
      delete hostRule.domainName;
      delete hostRule.token;

      add(hostRule);
      expect(findAllAuthenticatable({ hostType: 'nuget' } as any)).toEqual([
        hostRule,
      ]);
    });
    it('returns the hostRule if using domainName and password', () => {
      delete hostRule.hostName;
      delete hostRule.token;

      add(hostRule);
      expect(findAllAuthenticatable({ hostType: 'nuget' } as any)).toEqual([
        hostRule,
      ]);
    });
    it('returns the hostRule if using hostName and token', () => {
      delete hostRule.domainName;
      delete hostRule.password;

      add(hostRule);
      expect(findAllAuthenticatable({ hostType: 'nuget' } as any)).toEqual([
        hostRule,
      ]);
    });
    it('returns the hostRule if using domainName and token', () => {
      delete hostRule.hostName;
      delete hostRule.password;

      add(hostRule);
      expect(findAllAuthenticatable({ hostType: 'nuget' } as any)).toEqual([
        hostRule,
      ]);
    });
    it('returns the hostRule if using baseUrl and password', () => {
      hostRule.baseUrl = 'https://nuget.com';
      delete hostRule.domainName;
      delete hostRule.hostName;

      add(hostRule);
      expect(findAllAuthenticatable({ hostType: 'nuget' } as any)).toEqual([
        hostRule,
      ]);
    });
    it('returns the hostRule if using baseUrl and token', () => {
      hostRule.baseUrl = 'https://nuget.com';
      delete hostRule.hostName;
      delete hostRule.domainName;

      add(hostRule);
      expect(findAllAuthenticatable({ hostType: 'nuget' } as any)).toEqual([
        hostRule,
      ]);
    });
  });
});
