import { Fixtures } from '../../../../../../../test/fixtures';
import * as httpMock from '../../../../../../../test/http-mock';
import { findFirstParentVersion } from './parent-version';

const expressJson = Fixtures.getJson('express.json');

describe('modules/manager/npm/update/locked-dependency/common/parent-version', () => {
  describe('getLockedDependencies()', () => {
    it('finds indirect dependency', async () => {
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/send')
        .reply(200, {
          name: 'send',
          repository: {},
          versions: {
            '0.11.0': {},
            '0.11.1': {},
            '0.12.0': {},
            '0.13.0': {},
          },
          'dist-tags': { latest: '0.13.0' },
        });
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/express')
        .reply(200, expressJson);

      expect(
        await findFirstParentVersion('express', '4.0.0', 'send', '0.11.1'),
      ).toBe('4.11.1');
    });

    it('finds removed dependencies', async () => {
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/buffer-crc32')
        .reply(200, {
          name: 'buffer-crc32',
          repository: {},
          versions: {
            '10.0.0': {},
          },
          'dist-tags': { latest: '10.0.0' },
        });

      expect(
        await findFirstParentVersion(
          'express',
          '4.0.0',
          'buffer-crc32',
          '10.0.0',
        ),
      ).toBe('4.9.1');
    });

    it('finds when a greater version is needed', async () => {
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/qs')
        .reply(200, {
          name: 'qs',
          repository: {},
          versions: {
            '0.6.6': {},
            '6.0.4': {},
            '6.2.0': {},
          },
          'dist-tags': { latest: '6.2.0' },
        });

      expect(
        await findFirstParentVersion('express', '4.0.0', 'qs', '6.0.4'),
      ).toBe('4.14.0');
    });

    it('finds when a range matches greater versions', async () => {
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/type-is')
        .reply(200, {
          name: 'type-is',
          repository: {},
          versions: {
            '1.2.1': {},
            '1.6.15': {},
          },
          'dist-tags': { latest: '1.6.15' },
        });

      expect(
        await findFirstParentVersion('express', '4.16.1', 'type-is', '1.2.1'),
      ).toBe('4.16.1');
    });

    it('returns null if no matching', async () => {
      httpMock
        .scope('https://registry.npmjs.org')
        .get('/debug')
        .reply(200, {
          name: 'debug',
          repository: {},
          versions: {
            '10.0.0': {},
          },
          'dist-tags': { latest: '10.0.0' },
        });

      expect(
        await findFirstParentVersion('express', '4.16.1', 'debug', '9.0.0'),
      ).toBeNull();
    });
  });
});
