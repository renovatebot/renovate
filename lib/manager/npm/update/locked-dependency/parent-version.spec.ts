import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName, mocked } from '../../../../../test/util';
import * as fetch_ from './fetch';
import { findFirstParentVersion } from './parent-version';

jest.mock('./fetch');

const fetch = mocked(fetch_);

const expressJson = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/express.json'), 'utf8')
);

describe(getName(__filename), () => {
  beforeEach(() => {
    fetch.fetchRegistryDetails = jest.fn();
  });
  describe('getLockedDependencies()', () => {
    it('finds indirect dependency', async () => {
      fetch.fetchRegistryDetails.mockResolvedValueOnce({
        versions: {
          '0.11.0': null,
          '0.11.1': null,
          '0.12.0': null,
          '0.13.0': null,
        },
      } as any);
      fetch.fetchRegistryDetails.mockResolvedValueOnce(expressJson);
      expect(
        await findFirstParentVersion('express', '4.0.0', 'send', '0.11.1')
      ).toEqual('4.11.1');
    });
    it('finds indirect devDependency', async () => {
      fetch.fetchRegistryDetails.mockResolvedValueOnce({
        versions: {
          '1.0.1': null,
          '1.0.2': null,
        },
      } as any);
      fetch.fetchRegistryDetails.mockResolvedValueOnce(expressJson);
      expect(
        await findFirstParentVersion(
          'express',
          '4.0.0',
          'cookie-parser',
          '1.0.2'
        )
      ).toEqual('4.3.0');
    });
    it('finds removed dependencies', async () => {
      fetch.fetchRegistryDetails.mockResolvedValueOnce({
        versions: {
          '10.0.0': null,
        },
      } as any);
      fetch.fetchRegistryDetails.mockResolvedValueOnce(expressJson);
      expect(
        await findFirstParentVersion(
          'express',
          '4.0.0',
          'buffer-crc32',
          '10.0.0'
        )
      ).toEqual('4.9.1');
    });
    it('finds when a range matches greater versions', async () => {
      fetch.fetchRegistryDetails.mockResolvedValueOnce({
        versions: {
          '1.2.1': null,
          '1.6.15': null,
        },
      } as any);
      fetch.fetchRegistryDetails.mockResolvedValueOnce(expressJson);
      expect(
        await findFirstParentVersion('express', '4.16.1', 'type-is', '1.2.1')
      ).toEqual('4.16.1');
    });
    it('returns null if no matching', async () => {
      fetch.fetchRegistryDetails.mockResolvedValueOnce({
        versions: {
          '1.2.1': null,
          '10.0.0': null,
        },
      } as any);
      fetch.fetchRegistryDetails.mockResolvedValueOnce(expressJson);
      expect(
        await findFirstParentVersion('express', '4.16.1', 'type-is', '1.2.1')
      ).toBeNull();
    });
  });
});
