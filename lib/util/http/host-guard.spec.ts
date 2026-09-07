import { parseUrl } from '../url.ts';
import {
  classifyHostname,
  classifyIpAddress,
  classifyUrl,
} from './host-guard.ts';

describe('util/http/host-guard', () => {
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
      ${'169.254.169.253'}        | ${'internal'}
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
});
