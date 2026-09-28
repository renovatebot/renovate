import dns from 'node:dns';
import dnsPromises from 'node:dns/promises';
import type { NormalizedOptions, PlainResponse } from 'got';
import { logger, partial } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import { HOST_BLOCKED } from '../../constants/error-messages.ts';
import { hasProxy } from '../../proxy.ts';
import type { InternalHostGrant } from '../../types/index.ts';
import * as hostRules from '../host-rules.ts';
import { parseUrl } from '../url.ts';
import {
  applyHostGuard,
  checkUrl,
  classifyHostname,
  classifyIpAddress,
  classifyUrl,
} from './host-guard.ts';

vi.mock('node:dns', () => ({
  default: { lookup: vi.fn() },
}));
vi.mock('node:dns/promises', () => ({
  default: { lookup: vi.fn() },
}));
vi.mock('../../proxy.ts', () => ({
  hasProxy: vi.fn(),
}));

const lookupMock = vi.mocked(dns.lookup);
const promisesLookupMock = vi.mocked(dnsPromises.lookup);
const hasProxyMock = vi.mocked(hasProxy);

/** Resolves the given addresses for a `dns.promises.lookup(host, { all: true })` call. */
function mockResolvedAddresses(...addresses: string[]): void {
  promisesLookupMock.mockResolvedValue(
    addresses.map((address) => ({
      address,
      family: address.includes(':') ? 6 : 4,
    })) as never,
  );
}

describe('util/http/host-guard', () => {
  beforeEach(() => {
    GlobalConfig.reset();
    hostRules.clear();
  });
  describe('classifyIpAddress', () => {
    it.each`
      address              | expected
      ${'8.8.8.8'}         | ${null}
      ${'1.1.1.1'}         | ${null}
      ${'0.0.0.0'}         | ${'internal'}
      ${'0.255.255.255'}   | ${'internal'}
      ${'9.255.255.255'}   | ${null}
      ${'10.0.0.0'}        | ${'internal'}
      ${'10.255.255.255'}  | ${'internal'}
      ${'11.0.0.0'}        | ${null}
      ${'100.63.255.255'}  | ${null}
      ${'100.64.0.0'}      | ${'internal'}
      ${'100.127.255.255'} | ${'internal'}
      ${'100.128.0.0'}     | ${null}
      ${'126.255.255.255'} | ${null}
      ${'127.0.0.1'}       | ${'internal'}
      ${'127.255.255.255'} | ${'internal'}
      ${'128.0.0.0'}       | ${null}
      ${'169.253.255.255'} | ${null}
      ${'169.254.0.1'}     | ${'internal'}
      ${'169.254.255.255'} | ${'internal'}
      ${'169.255.0.0'}     | ${null}
      ${'172.15.255.255'}  | ${null}
      ${'172.16.0.0'}      | ${'internal'}
      ${'172.31.255.255'}  | ${'internal'}
      ${'172.32.0.0'}      | ${null}
      ${'192.167.255.255'} | ${null}
      ${'192.168.0.0'}     | ${'internal'}
      ${'192.168.255.255'} | ${'internal'}
      ${'192.169.0.0'}     | ${null}
      ${'223.255.255.255'} | ${null}
      ${'224.0.0.1'}       | ${'internal'}
      ${'239.255.255.255'} | ${'internal'}
    `('classifies IPv4 $address as $expected', ({ address, expected }) => {
      expect(classifyIpAddress(address)).toBe(expected);
    });

    it.each`
      address                   | expected
      ${'2606:4700:4700::1111'} | ${null}
      ${'2001:db8::1'}          | ${null}
      ${'::'}                   | ${'internal'}
      ${'::1'}                  | ${'internal'}
      ${'0:0:0:0:0:0:0:1'}      | ${'internal'}
      ${'fbff::1'}              | ${null}
      ${'fc00::1'}              | ${'internal'}
      ${'fd00::1'}              | ${'internal'}
      ${'fdff:ffff::1'}         | ${'internal'}
      ${'fe00::1'}              | ${null}
      ${'fe7f::1'}              | ${null}
      ${'fe80::1'}              | ${'internal'}
      ${'febf::1'}              | ${'internal'}
      ${'fec0::1'}              | ${null}
    `('classifies IPv6 $address as $expected', ({ address, expected }) => {
      expect(classifyIpAddress(address)).toBe(expected);
    });

    it.each`
      address                   | expected
      ${'::ffff:8.8.8.8'}       | ${null}
      ${'::ffff:0808:0808'}     | ${null}
      ${'::ffff:10.0.0.1'}      | ${'internal'}
      ${'::ffff:a00:1'}         | ${'internal'}
      ${'0:0:0:0:0:ffff:a00:1'} | ${'internal'}
      ${'::ffff:127.0.0.1'}     | ${'internal'}
      ${'::ffff:192.168.1.1'}   | ${'internal'}
      ${'::ffff:c0a8:0101'}     | ${'internal'}
    `(
      'classifies IPv4-mapped IPv6 $address as $expected',
      ({ address, expected }) => {
        expect(classifyIpAddress(address)).toBe(expected);
      },
    );

    it.each`
      address                     | expected
      ${'169.254.169.254'}        | ${'metadata'}
      ${'::ffff:169.254.169.254'} | ${'metadata'}
      ${'::ffff:a9fe:a9fe'}       | ${'metadata'}
      ${'fd00:ec2::254'}          | ${'metadata'}
      ${'169.254.170.2'}          | ${'metadata'}
      ${'::ffff:169.254.170.2'}   | ${'metadata'}
      ${'169.254.170.23'}         | ${'metadata'}
      ${'100.100.100.200'}        | ${'metadata'}
      ${'169.254.169.253'}        | ${'internal'}
      ${'169.254.170.3'}          | ${'internal'}
      ${'100.100.100.201'}        | ${'internal'}
    `(
      'classifies metadata endpoint $address as $expected',
      ({ address, expected }) => {
        expect(classifyIpAddress(address)).toBe(expected);
      },
    );

    it('fails closed for strings which are not IP addresses', () => {
      expect(classifyIpAddress('not-an-ip')).toBe('internal');
      expect(classifyIpAddress('')).toBe('internal');
    });
  });

  describe('classifyHostname', () => {
    it.each`
      hostname                                  | expected
      ${'metadata.google.internal'}             | ${'metadata'}
      ${'METADATA.GOOGLE.INTERNAL'}             | ${'metadata'}
      ${'metadata.google.internal.'}            | ${'metadata'}
      ${'metadata.packet.net'}                  | ${'metadata'}
      ${'example.com'}                          | ${null}
      ${'localhost'}                            | ${null}
      ${'metadata.google.internal.example.com'} | ${null}
    `('classifies $hostname as $expected', ({ hostname, expected }) => {
      expect(classifyHostname(hostname)).toBe(expected);
    });

    it.each`
      hostname                | reason
      ${'metadata.azure.com'} | ${'Azure serves instance metadata at 169.254.169.254, not under this name'}
      ${'anything.internal'}  | ${'the reserved TLD says nothing about what the name resolves to'}
      ${'mydevice.local'}     | ${'an mDNS name still has to resolve to a blocked address to be blocked'}
      ${'registry.corp'}      | ${'a private registry is only blocked by the address it resolves to'}
    `(
      'leaves $hostname to DNS-time classification, as $reason',
      ({ hostname }) => {
        expect(classifyHostname(hostname)).toBeNull();
      },
    );
  });

  describe('classifyUrl', () => {
    it.each`
      url                                      | expected
      ${'https://example.com/path'}            | ${null}
      ${'http://localhost:8080/'}              | ${null}
      ${'http://10.1.2.3:8080/'}               | ${'internal'}
      ${'http://127.0.0.1/'}                   | ${'internal'}
      ${'http://0x7f000001/'}                  | ${'internal'}
      ${'http://0177.0.0.1/'}                  | ${'internal'}
      ${'http://2130706433/'}                  | ${'internal'}
      ${'http://[::1]:6379/'}                  | ${'internal'}
      ${'http://[fe80::1]/'}                   | ${'internal'}
      ${'http://[::ffff:10.0.0.1]/'}           | ${'internal'}
      ${'http://169.254.169.254/latest/'}      | ${'metadata'}
      ${'http://[::ffff:169.254.169.254]/'}    | ${'metadata'}
      ${'http://metadata.google.internal/v1/'} | ${'metadata'}
      ${'https://8.8.8.8/'}                    | ${null}
    `('classifies $url as $expected', ({ url, expected }) => {
      expect(classifyUrl(parseUrl(url)!)).toBe(expected);
    });

    it('classifies hostnames which only resolve internally as unknown', () => {
      // `localhost` can only be decided at DNS lookup time
      expect(classifyUrl(parseUrl('http://localhost/')!)).toBeNull();
    });

    // userinfo is the classic way to make a URL read as one host while naming another - only what is after the `@` is the host
    it.each`
      url                                               | expected
      ${'http://user:pass@127.0.0.1/'}                  | ${'internal'}
      ${'http://example.com@127.0.0.1/'}                | ${'internal'}
      ${'http://example.com:8080@169.254.169.254/'}     | ${'metadata'}
      ${'http://user@metadata.google.internal/'}        | ${'metadata'}
      ${'http://user:pass@[::1]/'}                      | ${'internal'}
      ${'http://127.0.0.1@example.com/'}                | ${null}
      ${'http://169.254.169.254:80@example.com/'}       | ${null}
      ${'http://metadata.google.internal@example.com/'} | ${null}
    `(
      'classifies $url by its host, not its userinfo, as $expected',
      ({ url, expected }) => {
        expect(classifyUrl(parseUrl(url)!)).toBe(expected);
      },
    );
  });

  describe('checkUrl', () => {
    it('throws for a metadata endpoint even when internal hosts are allowed', () => {
      GlobalConfig.set({ internalHostAccess: 'allow' });

      expect(() =>
        checkUrl(
          parseUrl('http://169.254.169.254/latest/')!,
          'dummy',
          undefined,
        ),
      ).toThrow(HOST_BLOCKED);
      expect(() =>
        checkUrl(
          parseUrl('http://metadata.google.internal/')!,
          'dummy',
          undefined,
        ),
      ).toThrow(HOST_BLOCKED);
    });

    it.each`
      url
      ${'http://169.254.170.2/v2/credentials/'}
      ${'http://169.254.170.23/v1/credentials'}
      ${'http://100.100.100.200/latest/meta-data/'}
    `(
      'throws for credential-handing metadata endpoint $url however it is permitted',
      ({ url }: { url: string }) => {
        GlobalConfig.set({ internalHostAccess: 'allow' });

        expect(() => checkUrl(parseUrl(url)!, 'dummy', undefined)).toThrow(
          HOST_BLOCKED,
        );

        GlobalConfig.reset();

        expect(() =>
          checkUrl(
            parseUrl(url)!,
            'dummy',
            partial<InternalHostGrant>({ explicit: true }),
          ),
        ).toThrow(HOST_BLOCKED);
      },
    );

    it('throws for an internal host with internalHostAccess=block', () => {
      GlobalConfig.set({ internalHostAccess: 'block' });

      expect(() =>
        checkUrl(parseUrl('http://10.1.2.3:8080/')!, 'dummy', undefined),
      ).toThrow(HOST_BLOCKED);
      expect(() =>
        checkUrl(parseUrl('http://[::1]:6379/')!, 'dummy', undefined),
      ).toThrow(HOST_BLOCKED);
    });

    it('warns instead of throwing for an internal host by default', () => {
      expect(
        checkUrl(parseUrl('http://10.1.2.3:8080/')!, 'dummy', undefined),
      ).toBe('warn-dns');

      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        { hostname: '10.1.2.3', hostType: 'dummy' },
        'HTTP request to an internal host, which `internalHostAccess=block` would refuse - permit it with a `hostRules` entry naming the host, or one setting `allowInternal: true`, or set `internalHostAccess=block` to enforce this now. The default will become `block` in a future major release.',
      );
    });

    it('returns check-dns for a hostname without a grant', () => {
      GlobalConfig.set({ internalHostAccess: 'block' });

      expect(
        checkUrl(parseUrl('https://example.com/')!, 'dummy', undefined),
      ).toBe('check-dns');
    });

    it('returns warn-dns for a hostname without a grant by default', () => {
      expect(
        checkUrl(parseUrl('https://example.com/')!, 'dummy', undefined),
      ).toBe('warn-dns');
      expect(logger.logger.once.warn).not.toHaveBeenCalled();
    });

    it('grants everything except metadata with internalHostAccess=allow', () => {
      GlobalConfig.set({ internalHostAccess: 'allow' });

      expect(checkUrl(parseUrl('http://10.1.2.3/')!, 'dummy', undefined)).toBe(
        'granted',
      );
      expect(
        checkUrl(parseUrl('https://example.com/')!, 'dummy', undefined),
      ).toBe('granted');
    });

    it('grants the platform endpoint origin', () => {
      GlobalConfig.set({
        endpoint: 'http://10.1.2.3/api/v4/',
        internalHostAccess: 'block',
      });

      expect(
        checkUrl(parseUrl('http://10.1.2.3/foo')!, 'dummy', undefined),
      ).toBe('granted');
      expect(() =>
        checkUrl(parseUrl('http://10.1.2.4/foo')!, 'dummy', undefined),
      ).toThrow(HOST_BLOCKED);
    });

    it('does not grant another port on the platform endpoint host', () => {
      GlobalConfig.set({
        endpoint: 'http://10.1.2.3:8080/api/v4',
        internalHostAccess: 'block',
      });

      expect(
        checkUrl(parseUrl('http://10.1.2.3:8080/foo')!, 'dummy', undefined),
      ).toBe('granted');
      expect(() =>
        checkUrl(parseUrl('http://10.1.2.3:6379/x.json')!, 'dummy', undefined),
      ).toThrow(HOST_BLOCKED);
      expect(() =>
        checkUrl(parseUrl('http://10.1.2.3:9200/')!, 'dummy', undefined),
      ).toThrow(HOST_BLOCKED);
      expect(() =>
        checkUrl(parseUrl('http://10.1.2.3/foo')!, 'dummy', undefined),
      ).toThrow(HOST_BLOCKED);
    });

    it('does not grant another scheme on the platform endpoint host', () => {
      GlobalConfig.set({
        endpoint: 'https://10.1.2.3/api/v4',
        internalHostAccess: 'block',
      });

      expect(() =>
        checkUrl(parseUrl('http://10.1.2.3/foo')!, 'dummy', undefined),
      ).toThrow(HOST_BLOCKED);
    });

    it('grants the platform endpoint origin spelled with its default port', () => {
      GlobalConfig.set({ endpoint: 'https://10.1.2.3:443/api/v4' });

      expect(
        checkUrl(parseUrl('https://10.1.2.3/foo')!, 'dummy', undefined),
      ).toBe('granted');
    });

    it('grants via an explicit allowInternal', () => {
      expect(
        checkUrl(parseUrl('http://10.1.2.3/')!, 'dummy', {
          explicit: true,
          implicit: true,
        }),
      ).toBe('granted');
      expect(logger.logger.once.info).toHaveBeenCalledWith(
        'Internal host 10.1.2.3 permitted by configuration',
      );
      // a granted host must not warn, so that administrators can converge on no warnings before the default becomes `block`
      expect(logger.logger.once.warn).not.toHaveBeenCalled();
    });

    it('grants implicitly for a host the admin named', () => {
      expect(
        checkUrl(parseUrl('http://10.1.2.3/')!, 'dummy', { implicit: true }),
      ).toBe('granted');
    });

    it('blocks when an explicit allowInternal=false overrides the implicit grant', () => {
      GlobalConfig.set({ internalHostAccess: 'block' });

      expect(() =>
        checkUrl(parseUrl('http://10.1.2.3/')!, 'dummy', {
          explicit: false,
          implicit: true,
        }),
      ).toThrow(HOST_BLOCKED);
    });

    it('requires a scoped grant when the response becomes config', () => {
      GlobalConfig.set({ internalHostAccess: 'block' });
      const url = parseUrl('http://10.1.2.3/some-preset.json')!;

      expect(() => checkUrl(url, 'npm', { implicit: true }, true)).toThrow(
        HOST_BLOCKED,
      );
      expect(() =>
        checkUrl(url, 'npm', { explicit: true, implicit: true }, true),
      ).toThrow(HOST_BLOCKED);
      expect(
        checkUrl(
          url,
          'npm',
          { explicit: true, scoped: true, implicit: true },
          true,
        ),
      ).toBe('granted');
    });

    it('warns about an unscoped grant when the response becomes config', () => {
      const url = parseUrl('http://10.1.2.3/some-preset.json')!;

      expect(
        checkUrl(url, 'npm', { explicit: true, implicit: true }, true),
      ).toBe('warn-dns');

      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        { hostname: '10.1.2.3', hostType: 'npm' },
        'HTTP request to an internal host whose response becomes configuration, which `internalHostAccess=block` would refuse - permit it with a `hostRules` entry setting `allowInternal: true`, scoped with a `hostType` or a URL-prefix `matchHost`, or set `internalHostAccess=block` to enforce this now. The default will become `block` in a future major release.',
      );
    });

    it('does not warn about a scoped grant when the response becomes config', () => {
      const url = parseUrl('http://10.1.2.3/some-preset.json')!;

      expect(checkUrl(url, 'npm', { scoped: true, implicit: true }, true)).toBe(
        'granted',
      );
      expect(logger.logger.once.warn).not.toHaveBeenCalled();
    });

    it('accepts an implicit grant when the response is not config', () => {
      const url = parseUrl('http://10.1.2.3/some-package')!;

      expect(checkUrl(url, 'npm', { implicit: true })).toBe('granted');
      expect(checkUrl(url, 'npm', { implicit: true }, false)).toBe('granted');
    });

    it('still permits the platform endpoint when the response becomes config', () => {
      GlobalConfig.set({ endpoint: 'http://10.1.2.3/api/v4/' });

      expect(
        checkUrl(parseUrl('http://10.1.2.3/foo')!, 'npm', undefined, true),
      ).toBe('granted');
    });
  });

  describe('applyHostGuard', () => {
    it('blocks resolved internal addresses for ungranted hosts', () => {
      GlobalConfig.set({ internalHostAccess: 'block' });
      const guard = applyHostGuard(
        parseUrl('https://internal.example.com/')!,
        'dummy',
        undefined,
      );
      lookupMock.mockImplementation(((
        _hostname: string,
        _options: unknown,
        cb: (err: Error | null, address: string, family: number) => void,
      ) => cb(null, '10.0.0.1', 4)) as never);

      const callback = vi.fn();
      guard.dnsLookup('internal.example.com', {}, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ message: HOST_BLOCKED }),
        '10.0.0.1',
        4,
      );
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { hostname: 'internal.example.com', address: '10.0.0.1' },
        'Blocked HTTP request: hostname resolves to a blocked address',
      );
    });

    it('passes public addresses through', () => {
      const guard = applyHostGuard(
        parseUrl('https://example.com/')!,
        'dummy',
        undefined,
      );
      lookupMock.mockImplementation(((
        _hostname: string,
        _options: unknown,
        cb: (err: Error | null, address: string, family: number) => void,
      ) => cb(null, '93.184.216.34', 4)) as never);

      const callback = vi.fn();
      guard.dnsLookup('example.com', {}, callback);

      expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
    });

    it('validates every record when resolving all addresses', () => {
      GlobalConfig.set({ internalHostAccess: 'block' });
      const guard = applyHostGuard(
        parseUrl('https://example.com/')!,
        'dummy',
        undefined,
      );
      const addresses = [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ];
      lookupMock.mockImplementation(((
        _hostname: string,
        _options: unknown,
        cb: (err: Error | null, address: unknown) => void,
      ) => cb(null, addresses)) as never);

      const callback = vi.fn();
      guard.dnsLookup('example.com', { all: true }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ message: HOST_BLOCKED }),
        addresses,
        undefined,
      );
    });

    it('passes lookup errors through', () => {
      const guard = applyHostGuard(
        parseUrl('https://example.com/')!,
        'dummy',
        undefined,
      );
      const lookupError = new Error('ENOTFOUND');
      lookupMock.mockImplementation(((
        _hostname: string,
        _options: unknown,
        cb: (err: Error | null, address?: string, family?: number) => void,
      ) => cb(lookupError)) as never);

      const callback = vi.fn();
      guard.dnsLookup('example.com', {}, callback);

      expect(callback).toHaveBeenCalledWith(lookupError, undefined, undefined);
    });

    it('still blocks resolved metadata addresses for granted hosts', () => {
      GlobalConfig.set({ internalHostAccess: 'allow' });
      const guard = applyHostGuard(
        parseUrl('https://internal.example.com/')!,
        'dummy',
        undefined,
      );
      lookupMock.mockImplementation(((
        _hostname: string,
        _options: unknown,
        cb: (err: Error | null, address: string, family: number) => void,
      ) => cb(null, '169.254.169.254', 4)) as never);

      const callback = vi.fn();
      guard.dnsLookup('internal.example.com', {}, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ message: HOST_BLOCKED }),
        '169.254.169.254',
        4,
      );
    });

    it('permits resolved internal addresses for granted hosts', () => {
      GlobalConfig.set({ internalHostAccess: 'allow' });
      const guard = applyHostGuard(
        parseUrl('https://internal.example.com/')!,
        'dummy',
        undefined,
      );
      lookupMock.mockImplementation(((
        _hostname: string,
        _options: unknown,
        cb: (err: Error | null, address: string, family: number) => void,
      ) => cb(null, '10.0.0.1', 4)) as never);

      const callback = vi.fn();
      guard.dnsLookup('internal.example.com', {}, callback);

      expect(callback).toHaveBeenCalledWith(null, '10.0.0.1', 4);
    });

    it('warns instead of blocking resolved internal addresses by default', () => {
      const guard = applyHostGuard(
        parseUrl('https://internal.example.com/')!,
        'dummy',
        undefined,
      );
      lookupMock.mockImplementation(((
        _hostname: string,
        _options: unknown,
        cb: (err: Error | null, address: string, family: number) => void,
      ) => cb(null, '10.0.0.1', 4)) as never);

      const callback = vi.fn();
      guard.dnsLookup('internal.example.com', {}, callback);

      expect(callback).toHaveBeenCalledWith(null, '10.0.0.1', 4);
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        { hostname: 'internal.example.com', hostType: 'dummy' },
        expect.stringContaining('HTTP request to an internal host'),
      );
    });

    it('still blocks a resolved metadata address by default', () => {
      const guard = applyHostGuard(
        parseUrl('https://internal.example.com/')!,
        'dummy',
        undefined,
      );
      const addresses = [
        { address: '10.0.0.1', family: 4 },
        { address: '169.254.169.254', family: 4 },
      ];
      lookupMock.mockImplementation(((
        _hostname: string,
        _options: unknown,
        cb: (err: Error | null, address: unknown) => void,
      ) => cb(null, addresses)) as never);

      const callback = vi.fn();
      guard.dnsLookup('internal.example.com', { all: true }, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ message: HOST_BLOCKED }),
        addresses,
        undefined,
      );
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { hostname: 'internal.example.com', address: '169.254.169.254' },
        'Blocked HTTP request: hostname resolves to a blocked address',
      );
      expect(logger.logger.once.warn).not.toHaveBeenCalled();
    });

    describe('beforeRedirect', () => {
      it('blocks a redirect to an internal target', () => {
        GlobalConfig.set({ internalHostAccess: 'block' });
        const guard = applyHostGuard(
          parseUrl('https://example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('http://127.0.0.1/steal')!,
          headers: {},
        });

        expect(() => guard.beforeRedirect(options, partial())).toThrow(
          HOST_BLOCKED,
        );
      });

      it('fails closed when the redirect target is not a parsed URL', () => {
        const guard = applyHostGuard(
          parseUrl('https://example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({ url: undefined });

        expect(() => guard.beforeRedirect(options, partial())).toThrow(
          HOST_BLOCKED,
        );
      });

      it('keeps requiring a scoped grant for a config-fetching redirect', () => {
        GlobalConfig.set({ internalHostAccess: 'block' });
        hostRules.add({ matchHost: '10.1.2.3' }, { trusted: true });
        const guard = applyHostGuard(
          parseUrl('https://example.com/')!,
          'npm',
          undefined,
          true,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('http://10.1.2.3/presets/evil.json')!,
          headers: {},
        });

        expect(() => guard.beforeRedirect(options, partial())).toThrow(
          HOST_BLOCKED,
        );

        hostRules.add(
          { matchHost: 'http://10.1.2.3/presets/', allowInternal: true },
          { trusted: true },
        );

        expect(() => guard.beforeRedirect(options, partial())).not.toThrow();
      });

      it('warns instead of blocking a redirect to an internal target by default', () => {
        const guard = applyHostGuard(
          parseUrl('https://example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('http://127.0.0.1/steal')!,
          headers: {},
        });

        expect(() => guard.beforeRedirect(options, partial())).not.toThrow();
        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          { hostname: '127.0.0.1', hostType: 'dummy' },
          expect.stringContaining('HTTP request to an internal host'),
        );
      });

      it('re-evaluates grants for the redirect target host', () => {
        hostRules.add({ matchHost: '10.1.2.3' }, { trusted: true });
        const guard = applyHostGuard(
          parseUrl('https://example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('http://10.1.2.3/artifact')!,
          headers: {},
        });

        expect(() => guard.beforeRedirect(options, partial())).not.toThrow();
        expect(options.dnsLookup).toBeFunction();
      });

      // got strips the credentials it knows about (`authorization`, `cookie`, URL userinfo) before this hook runs, but not `Private-token`, and not whatever a `hostRules` entry configured
      describe('cross-origin credentials', () => {
        function redirect(
          from: string,
          to: string,
          headers: Record<string, string>,
        ): NormalizedOptions {
          const guard = applyHostGuard(parseUrl(from)!, 'gitlab', undefined);
          const options = partial<NormalizedOptions>({
            url: parseUrl(to)!,
            headers: { ...headers },
          });
          void guard.beforeRedirect(
            options,
            partial<PlainResponse>({ url: from }),
          );
          return options;
        }

        it('strips credential headers when the redirect leaves the origin', () => {
          const options = redirect(
            'https://gitlab.example.com/api/v4/x',
            'https://evil.example.com/x',
            {
              'private-token': 'glpat-secret',
              authorization: 'Bearer secret',
              cookie: 'session=secret',
              accept: 'application/json',
            },
          );

          expect(options.headers).toEqual({ accept: 'application/json' });
        });

        it('strips credential headers when the redirect downgrades to http', () => {
          const options = redirect(
            'https://gitlab.example.com/api/v4/x',
            'http://gitlab.example.com/x',
            { 'private-token': 'glpat-secret' },
          );

          expect(options.headers).toEqual({});
        });

        it('keeps credential headers on a same-origin redirect', () => {
          const headers = {
            'private-token': 'glpat-secret',
            authorization: 'Bearer secret',
          };
          const options = redirect(
            'https://gitlab.example.com/api/v4/x',
            'https://gitlab.example.com/api/v4/y',
            headers,
          );

          expect(options.headers).toEqual(headers);
        });

        it('strips the headers a hostRule configured for the source host', () => {
          hostRules.add(
            {
              matchHost: 'registry.example.com',
              headers: { 'X-Api-Key': 'secret' },
            },
            { trusted: true },
          );

          const options = redirect(
            'https://registry.example.com/artifact',
            'https://cdn.example.com/artifact',
            { 'x-api-key': 'secret', accept: 'application/json' },
          );

          expect(options.headers).toEqual({ accept: 'application/json' });
        });

        it('strips credential headers when the source URL cannot be parsed', () => {
          const guard = applyHostGuard(
            parseUrl('https://gitlab.example.com/')!,
            'gitlab',
            undefined,
          );
          const options = partial<NormalizedOptions>({
            url: parseUrl('https://evil.example.com/')!,
            headers: {
              'private-token': 'glpat-secret',
              accept: 'application/json',
            },
          });

          void guard.beforeRedirect(
            options,
            partial<PlainResponse>({ url: 'not a url' }),
          );

          expect(options.headers).toEqual({ accept: 'application/json' });
        });
      });
    });

    describe('beforeRequest pre-flight for proxied requests', () => {
      it('is not added when no proxy is configured', () => {
        hasProxyMock.mockReturnValue(false);

        const guard = applyHostGuard(
          parseUrl('https://example.com/')!,
          'dummy',
          undefined,
        );

        expect(guard.beforeRequest).toBeUndefined();
      });

      it('blocks a hostname which resolves to an internal address', async () => {
        hasProxyMock.mockReturnValue(true);
        GlobalConfig.set({ internalHostAccess: 'block' });
        mockResolvedAddresses('93.184.216.34', '10.0.0.1');
        const guard = applyHostGuard(
          parseUrl('https://internal.example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('https://internal.example.com/')!,
        });

        await expect(
          guard.beforeRequest!(options, { retryCount: 0 }),
        ).rejects.toThrow(HOST_BLOCKED);
        expect(promisesLookupMock).toHaveBeenCalledWith(
          'internal.example.com',
          { all: true },
        );
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { hostname: 'internal.example.com', address: '10.0.0.1' },
          'Blocked HTTP request: hostname resolves to a blocked address',
        );
      });

      it('permits a hostname which resolves to a public address', async () => {
        hasProxyMock.mockReturnValue(true);
        mockResolvedAddresses('93.184.216.34');
        const guard = applyHostGuard(
          parseUrl('https://example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('https://example.com/')!,
        });

        await expect(
          guard.beforeRequest!(options, { retryCount: 0 }),
        ).resolves.toBeUndefined();
      });

      it('permits internal addresses for a granted host, but not metadata ones', async () => {
        hasProxyMock.mockReturnValue(true);
        GlobalConfig.set({ internalHostAccess: 'allow' });
        const guard = applyHostGuard(
          parseUrl('https://internal.example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('https://internal.example.com/')!,
        });

        mockResolvedAddresses('10.0.0.1');
        await expect(
          guard.beforeRequest!(options, { retryCount: 0 }),
        ).resolves.toBeUndefined();

        mockResolvedAddresses('169.254.169.254');
        await expect(
          guard.beforeRequest!(options, { retryCount: 0 }),
        ).rejects.toThrow(HOST_BLOCKED);
      });

      it('fails open when the hostname cannot be resolved locally', async () => {
        hasProxyMock.mockReturnValue(true);
        promisesLookupMock.mockRejectedValue(new Error('ENOTFOUND'));
        const guard = applyHostGuard(
          parseUrl('https://example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('https://example.com/')!,
        });

        await expect(
          guard.beforeRequest!(options, { retryCount: 0 }),
        ).resolves.toBeUndefined();
        expect(logger.logger.once.debug).toHaveBeenCalledWith(
          'Host guard could not resolve example.com - relying on the proxy for this request',
        );
      });

      it('does not resolve IP-literal hosts', async () => {
        hasProxyMock.mockReturnValue(true);
        GlobalConfig.set({ internalHostAccess: 'allow' });
        const guard = applyHostGuard(
          parseUrl('http://[fd00::1]/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('http://[fd00::1]/')!,
        });

        await expect(
          guard.beforeRequest!(options, { retryCount: 0 }),
        ).resolves.toBeUndefined();
        expect(promisesLookupMock).not.toHaveBeenCalled();
      });

      it('warns about a hostname which resolves to an internal address by default', async () => {
        hasProxyMock.mockReturnValue(true);
        mockResolvedAddresses('93.184.216.34', '10.0.0.1');
        const guard = applyHostGuard(
          parseUrl('https://internal.example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('https://internal.example.com/')!,
        });

        await expect(
          guard.beforeRequest!(options, { retryCount: 0 }),
        ).resolves.toBeUndefined();
        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          { hostname: 'internal.example.com', hostType: 'dummy' },
          expect.stringContaining('HTTP request to an internal host'),
        );
      });

      it('validates the redirect target, with its own grant', async () => {
        hasProxyMock.mockReturnValue(true);
        GlobalConfig.set({ internalHostAccess: 'block' });
        mockResolvedAddresses('10.0.0.1');
        const guard = applyHostGuard(
          parseUrl('https://example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({
          url: parseUrl('https://internal.example.com/redirected')!,
          headers: {},
        });

        await guard.beforeRedirect(options, partial());

        await expect(
          guard.beforeRequest!(options, { retryCount: 0 }),
        ).rejects.toThrow(HOST_BLOCKED);

        hostRules.add(
          { matchHost: 'internal.example.com', allowInternal: true },
          { trusted: true },
        );
        await expect(
          guard.beforeRequest!(options, { retryCount: 0 }),
        ).resolves.toBeUndefined();
      });

      it('does not grant a config-fetching request an unscoped grant', async () => {
        hasProxyMock.mockReturnValue(true);
        GlobalConfig.set({ internalHostAccess: 'block' });
        mockResolvedAddresses('10.0.0.1');
        hostRules.add(
          { matchHost: 'internal.example.com', allowInternal: true },
          { trusted: true },
        );
        const url = parseUrl('https://internal.example.com/preset.json')!;
        const options = partial<NormalizedOptions>({ url });

        const configGuard = applyHostGuard(url, 'npm', undefined, true);
        await expect(
          configGuard.beforeRequest!(options, { retryCount: 0 }),
        ).rejects.toThrow(HOST_BLOCKED);

        const plainGuard = applyHostGuard(url, 'npm', undefined);
        await expect(
          plainGuard.beforeRequest!(options, { retryCount: 0 }),
        ).resolves.toBeUndefined();
      });

      it('fails closed when the request target is not a parsed URL', async () => {
        hasProxyMock.mockReturnValue(true);
        const guard = applyHostGuard(
          parseUrl('https://example.com/')!,
          'dummy',
          undefined,
        );
        const options = partial<NormalizedOptions>({ url: undefined });

        await expect(
          guard.beforeRequest!(options, { retryCount: 0 }),
        ).rejects.toThrow(HOST_BLOCKED);
      });
    });
  });
});
