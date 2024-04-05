import type { HostRule } from '../../../types';
import { add, clear } from '../../../util/host-rules';

import {
  findAllAuthenticatable,
  getAuthenticationHeaderValue,
} from './host-rules';

describe('modules/manager/bundler/host-rules', () => {
  beforeEach(() => {
    clear();
  });

  describe('getAuthenticationHeaderValue()', () => {
    it('returns the authentication header with the password', () => {
      expect(
        getAuthenticationHeaderValue({
          username: 'test',
          password: 'password',
        }),
      ).toBe('test:password');
    });

    it('returns the authentication header with the token', () => {
      expect(
        getAuthenticationHeaderValue({
          token: 'token',
        }),
      ).toBe('token');
    });
  });

  describe('findAllAuthenticatable()', () => {
    let hostRule: HostRule;

    beforeEach(() => {
      hostRule = {
        hostType: 'nuget',
        matchHost: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
        token: 'token',
      };
    });

    it('returns an empty array if matchHost is missing', () => {
      delete hostRule.matchHost;
      add(hostRule);
      expect(
        findAllAuthenticatable({ hostType: 'nuget' } as any),
      ).toBeEmptyArray();
    });

    it('returns an empty array if username is missing and password is present', () => {
      delete hostRule.username;
      delete hostRule.token;

      add(hostRule);
      expect(
        findAllAuthenticatable({ hostType: 'nuget' } as any),
      ).toBeEmptyArray();
    });

    it('returns an empty array if password and token are missing', () => {
      delete hostRule.password;
      delete hostRule.token;

      add(hostRule);
      expect(
        findAllAuthenticatable({ hostType: 'nuget' } as any),
      ).toBeEmptyArray();
    });

    it('returns the hostRule if using matchHost and password', () => {
      delete hostRule.token;

      add(hostRule);
      expect(
        findAllAuthenticatable({ hostType: 'nuget' } as any),
      ).toMatchObject([hostRule]);
    });

    it('returns the hostRule if using matchHost and token', () => {
      delete hostRule.password;

      add(hostRule);
      expect(
        findAllAuthenticatable({ hostType: 'nuget' } as any),
      ).toMatchObject([hostRule]);
    });

    it('returns the hostRule if using baseUrl and password', () => {
      hostRule.matchHost = 'https://nuget.com';

      add(hostRule);
      expect(
        findAllAuthenticatable({ hostType: 'nuget' } as any),
      ).toMatchObject([hostRule]);
    });

    it('returns the hostRule if using baseUrl and token', () => {
      hostRule.matchHost = 'https://nuget.com';

      add(hostRule);
      expect(
        findAllAuthenticatable({ hostType: 'nuget' } as any),
      ).toMatchObject([hostRule]);
    });
  });
});
