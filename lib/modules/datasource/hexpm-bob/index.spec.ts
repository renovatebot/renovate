import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';

describe('modules/datasource/hexpm-bob/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          depName: 'elixir',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'elixir',
        })
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(200, '');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'elixir',
        })
      ).toBeNull();
    });

    it('returns empty list for empty 200 OK', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(200, '');
      expect(
        await getPkgReleases({
          datasource,
          depName: 'elixir',
        })
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(502);
      await expect(
        getPkgReleases({
          datasource,
          depName: 'elixir',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(200, Fixtures.get('elixir/builds.txt'));
      const res = await getPkgReleases({
        datasource,
        depName: 'elixir',
      });
      expect(res).toEqual({
        changelogUrl: 'https://github.com/elixir-lang/elixir/releases',
        homepage: 'https://elixir-lang.org/',
        isPrivate: false,
        registryUrl: 'https://repo.hex.pm',
        releases: [
          {
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-otp-23.tar.gz',
            gitRef: 'c5151e6890b5ac8df13276459696f0f47a8e634b',
            isStable: true,
            newDigest:
              'cfe28e62c152235b948a0a89a833cb2795302604a5c21fe06f85a6f786e67b28',
            releaseTimestamp: '2022-09-01T18:24:15.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/c5151e6890b5ac8df13276459696f0f47a8e634b',
            version: '1.14.0-otp-23',
          },
          {
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-otp-24.tar.gz',
            gitRef: 'c5151e6890b5ac8df13276459696f0f47a8e634b',
            isStable: true,
            newDigest:
              '4f1f97ccad09e2f721fac76524a9588d77deade0a5c7a36df748d21ff1aa09db',
            releaseTimestamp: '2022-09-01T18:22:43.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/c5151e6890b5ac8df13276459696f0f47a8e634b',
            version: '1.14.0-otp-24',
          },
          {
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-otp-25.tar.gz',
            gitRef: 'c5151e6890b5ac8df13276459696f0f47a8e634b',
            isStable: true,
            newDigest:
              '988002ad716a04ca88cb5df0f392f753424870fad09f2f9dcec2b0ab0ceabe5d',
            releaseTimestamp: '2022-09-01T18:21:29.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/c5151e6890b5ac8df13276459696f0f47a8e634b',
            version: '1.14.0-otp-25',
          },
          {
            changelogUrl:
              'https://github.com/elixir-lang/elixir/releases/tag/v1.14.0-rc.0',
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-rc.0.tar.gz',
            gitRef: '6449239782ac76a14684628aa22af2246ad45b48',
            isStable: false,
            newDigest:
              'cdd7693d136ce701edc4b8ce8da62d21be9f8c8702da85abd2b37b2374b4d847',
            releaseTimestamp: '2022-08-01T14:28:18.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/6449239782ac76a14684628aa22af2246ad45b48',
            version: '1.14.0-rc.0',
          },
          {
            changelogUrl:
              'https://github.com/elixir-lang/elixir/releases/tag/v1.14.0-rc.1',
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-rc.1.tar.gz',
            gitRef: '185eeec5ecbc2a0c8d9b8b97cb2d23108615ffdb',
            isStable: false,
            newDigest:
              'bb348d669f09b1a29785bc2566952c300ebfc5afca59bed25cd224ead2d38fca',
            releaseTimestamp: '2022-08-15T10:28:05.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/185eeec5ecbc2a0c8d9b8b97cb2d23108615ffdb',
            version: '1.14.0-rc.1',
          },
          {
            changelogUrl:
              'https://github.com/elixir-lang/elixir/releases/tag/v1.14.0-rc.0-otp-23',
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-rc.0-otp-23.tar.gz',
            gitRef: '6449239782ac76a14684628aa22af2246ad45b48',
            isStable: false,
            newDigest:
              'cdd7693d136ce701edc4b8ce8da62d21be9f8c8702da85abd2b37b2374b4d847',
            releaseTimestamp: '2022-08-01T14:28:12.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/6449239782ac76a14684628aa22af2246ad45b48',
            version: '1.14.0-rc.0-otp-23',
          },
          {
            changelogUrl:
              'https://github.com/elixir-lang/elixir/releases/tag/v1.14.0-rc.0-otp-24',
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-rc.0-otp-24.tar.gz',
            gitRef: '6449239782ac76a14684628aa22af2246ad45b48',
            isStable: false,
            newDigest:
              'a959d9051afaa21618a846fac1f2d47e965820940a2655a94b8517ab5c752ed7',
            releaseTimestamp: '2022-08-01T14:26:47.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/6449239782ac76a14684628aa22af2246ad45b48',
            version: '1.14.0-rc.0-otp-24',
          },
          {
            changelogUrl:
              'https://github.com/elixir-lang/elixir/releases/tag/v1.14.0-rc.0-otp-25',
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-rc.0-otp-25.tar.gz',
            gitRef: '6449239782ac76a14684628aa22af2246ad45b48',
            isStable: false,
            newDigest:
              'c53f617d2ddeca5472617fea72cf5d5b3790077195933d78248a3cb6e421ed23',
            releaseTimestamp: '2022-08-01T14:25:42.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/6449239782ac76a14684628aa22af2246ad45b48',
            version: '1.14.0-rc.0-otp-25',
          },
          {
            changelogUrl:
              'https://github.com/elixir-lang/elixir/releases/tag/v1.14.0-rc.1-otp-23',
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-rc.1-otp-23.tar.gz',
            gitRef: '185eeec5ecbc2a0c8d9b8b97cb2d23108615ffdb',
            isStable: false,
            newDigest:
              'bb348d669f09b1a29785bc2566952c300ebfc5afca59bed25cd224ead2d38fca',
            releaseTimestamp: '2022-08-15T10:27:59.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/185eeec5ecbc2a0c8d9b8b97cb2d23108615ffdb',
            version: '1.14.0-rc.1-otp-23',
          },
          {
            changelogUrl:
              'https://github.com/elixir-lang/elixir/releases/tag/v1.14.0-rc.1-otp-24',
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-rc.1-otp-24.tar.gz',
            gitRef: '185eeec5ecbc2a0c8d9b8b97cb2d23108615ffdb',
            isStable: false,
            newDigest:
              '94fcd0e99468a4448560fc50e6e7a60b10a981d722d3399310e0fa410be8b655',
            releaseTimestamp: '2022-08-15T10:26:20.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/185eeec5ecbc2a0c8d9b8b97cb2d23108615ffdb',
            version: '1.14.0-rc.1-otp-24',
          },
          {
            changelogUrl:
              'https://github.com/elixir-lang/elixir/releases/tag/v1.14.0-rc.1-otp-25',
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.0-rc.1-otp-25.tar.gz',
            gitRef: '185eeec5ecbc2a0c8d9b8b97cb2d23108615ffdb',
            isStable: false,
            newDigest:
              '73d443e3c0b1dc9eb7c4427c919f905effbd6ae424babf13dcd7318d1ff95a2c',
            releaseTimestamp: '2022-08-15T10:25:05.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/185eeec5ecbc2a0c8d9b8b97cb2d23108615ffdb',
            version: '1.14.0-rc.1-otp-25',
          },
          {
            downloadUrl: 'https://repo.hex.pm/builds/elixir/v1.14.0.tar.gz',
            gitRef: 'c5151e6890b5ac8df13276459696f0f47a8e634b',
            isStable: true,
            newDigest:
              'cfe28e62c152235b948a0a89a833cb2795302604a5c21fe06f85a6f786e67b28',
            releaseTimestamp: '2022-09-01T18:24:21.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/c5151e6890b5ac8df13276459696f0f47a8e634b',
            version: '1.14.0',
          },
          {
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.1-otp-23.tar.gz',
            gitRef: 'a285e5876b6f69e7c340d04851aae63c8a32bf1d',
            isStable: true,
            newDigest:
              'bf4f583fff737fb0730d97e716262f012a7e643c5d5d5aaa8d5465b7ac18e6d4',
            releaseTimestamp: '2022-10-10T22:27:41.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/a285e5876b6f69e7c340d04851aae63c8a32bf1d',
            version: '1.14.1-otp-23',
          },
          {
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.1-otp-24.tar.gz',
            gitRef: 'a285e5876b6f69e7c340d04851aae63c8a32bf1d',
            isStable: true,
            newDigest:
              '690b00dab71d38adca77ed9ea97114fce3b9ca4a28f7fb47fff6d8839454af35',
            releaseTimestamp: '2022-10-10T22:26:51.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/a285e5876b6f69e7c340d04851aae63c8a32bf1d',
            version: '1.14.1-otp-24',
          },
          {
            downloadUrl:
              'https://repo.hex.pm/builds/elixir/v1.14.1-otp-25.tar.gz',
            gitRef: 'a285e5876b6f69e7c340d04851aae63c8a32bf1d',
            isStable: true,
            newDigest:
              '2f7e7ce830883b912c0a330a488af39f09852fddcc80061f536bb240df56836c',
            releaseTimestamp: '2022-10-10T22:26:05.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/a285e5876b6f69e7c340d04851aae63c8a32bf1d',
            version: '1.14.1-otp-25',
          },
          {
            downloadUrl: 'https://repo.hex.pm/builds/elixir/v1.14.1.tar.gz',
            gitRef: 'a285e5876b6f69e7c340d04851aae63c8a32bf1d',
            isStable: true,
            newDigest:
              'bf4f583fff737fb0730d97e716262f012a7e643c5d5d5aaa8d5465b7ac18e6d4',
            releaseTimestamp: '2022-10-10T22:27:46.000Z',
            sourceUrl:
              'https://github.com/elixir-lang/elixir/tree/a285e5876b6f69e7c340d04851aae63c8a32bf1d',
            version: '1.14.1',
          },
        ],
        sourceUrl: 'https://github.com/elixir-lang/elixir',
      });
    });

    it('processes real data (erlang / ubuntu 20.04)', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/otp/ubuntu-20.04/builds.txt')
        .reply(200, Fixtures.get('otp/ubuntu-20.04/builds.txt'));
      const res = await getPkgReleases({
        datasource,
        depName: 'otp/ubuntu-20.04',
      });

      expect(res).toEqual({
        changelogUrl: 'https://github.com/erlang/otp/releases',
        homepage: 'https://www.erlang.org/',
        isPrivate: false,
        registryUrl: 'https://repo.hex.pm',
        releases: [
          {
            downloadUrl:
              'https://repo.hex.pm/builds/otp/ubuntu-20.04/OTP-25.0.1.tar.gz',
            gitRef: 'cf18f250a40f33cc648d869eac833cd9aee86ed6',
            isStable: true,
            releaseTimestamp: '2022-06-09T08:35:26.000Z',
            sourceUrl:
              'https://github.com/erlang/otp/tree/cf18f250a40f33cc648d869eac833cd9aee86ed6',
            version: '25.0.1',
          },
          {
            downloadUrl:
              'https://repo.hex.pm/builds/otp/ubuntu-20.04/OTP-25.0.2.tar.gz',
            gitRef: 'ac0c9879c68b23278178a7afe738285b33ff1832',
            isStable: true,
            releaseTimestamp: '2022-06-21T07:26:41.000Z',
            sourceUrl:
              'https://github.com/erlang/otp/tree/ac0c9879c68b23278178a7afe738285b33ff1832',
            version: '25.0.2',
          },
          {
            downloadUrl:
              'https://repo.hex.pm/builds/otp/ubuntu-20.04/OTP-25.0.3.tar.gz',
            gitRef: '89c04fb1836fb865565125a4d5880b93e784d856',
            isStable: true,
            releaseTimestamp: '2022-07-19T18:15:31.000Z',
            sourceUrl:
              'https://github.com/erlang/otp/tree/89c04fb1836fb865565125a4d5880b93e784d856',
            version: '25.0.3',
          },
          {
            downloadUrl:
              'https://repo.hex.pm/builds/otp/ubuntu-20.04/OTP-25.0.4.tar.gz',
            gitRef: 'c028b855ee3f12c835ff3538a90ac5dbc155631b',
            isStable: true,
            releaseTimestamp: '2022-08-18T15:22:02.000Z',
            sourceUrl:
              'https://github.com/erlang/otp/tree/c028b855ee3f12c835ff3538a90ac5dbc155631b',
            version: '25.0.4',
          },
          {
            downloadUrl:
              'https://repo.hex.pm/builds/otp/ubuntu-20.04/OTP-25.1.1.tar.gz',
            gitRef: 'be6f05d34736fadf37328058f00e788cb88da61b',
            isStable: true,
            releaseTimestamp: '2022-10-03T13:33:42.000Z',
            sourceUrl:
              'https://github.com/erlang/otp/tree/be6f05d34736fadf37328058f00e788cb88da61b',
            version: '25.1.1',
          },
          {
            downloadUrl:
              'https://repo.hex.pm/builds/otp/ubuntu-20.04/OTP-25.1.2.tar.gz',
            gitRef: '38ad8e28421c745c06ef9bd55f6e6204cd1f15ef',
            isStable: true,
            releaseTimestamp: '2022-10-24T13:23:18.000Z',
            sourceUrl:
              'https://github.com/erlang/otp/tree/38ad8e28421c745c06ef9bd55f6e6204cd1f15ef',
            version: '25.1.2',
          },
        ],
        sourceUrl: 'https://github.com/erlang/otp',
      });
    });

    it('can override registry url', async () => {
      const registryUrl = 'https://repo.example.com/';

      httpMock
        .scope(registryUrl)
        .get('/builds/otp/ubuntu-20.04/builds.txt')
        .reply(200, Fixtures.get('otp/ubuntu-20.04/builds.txt'));

      const res = await getPkgReleases({
        datasource,
        depName: 'otp/ubuntu-20.04',
        registryUrls: [registryUrl],
      });

      expect(res?.releases).toHaveLength(6);
    });

    it('returns empty list for invalid package name', async () => {
      expect(
        await getPkgReleases({
          datasource,
          depName: 'invalid',
        })
      ).toBeNull();
    });
  });
});
