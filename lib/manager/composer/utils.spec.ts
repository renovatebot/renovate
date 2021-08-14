import { getName, mocked } from '../../../test/util';
import * as _datasource from '../../datasource';
import { extractContraints, getComposerConstraint } from './utils';

jest.mock('../../../lib/datasource');

const datasource = mocked(_datasource);

describe(getName(), () => {
  describe('getComposerConstraint', () => {
    beforeEach(() => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.1.0' },
          { version: '1.3.0' },
          { version: '2.0.14' },
          { version: '2.1.0' },
        ],
      });
    });
    it('returns from config', async () => {
      expect(await getComposerConstraint({ composer: '1.1.0' })).toEqual(
        '1.1.0'
      );
    });

    it('returns from latest', async () => {
      expect(await getComposerConstraint({})).toEqual('2.1.0');
    });

    it('throws no releases', async () => {
      datasource.getPkgReleases.mockReset();
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [],
      });
      await expect(getComposerConstraint({})).rejects.toThrow(
        'No composer releases found.'
      );
    });

    it('throws no compatible releases', async () => {
      datasource.getPkgReleases.mockReset();
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.3' }],
      });
      await expect(
        getComposerConstraint({ composer: '^3.1.0' })
      ).rejects.toThrow('No compatible composer releases found.');
    });
  });

  describe('extractContraints', () => {
    it('returns from require', () => {
      expect(
        extractContraints(
          { require: { php: '>=5.3.2', 'composer/composer': '1.1.0' } },
          {}
        )
      ).toEqual({ php: '>=5.3.2', composer: '1.1.0' });
    });

    it('returns from require-dev', () => {
      expect(
        extractContraints(
          { 'require-dev': { 'composer/composer': '1.1.0' } },
          {}
        )
      ).toEqual({ composer: '1.1.0' });
    });

    it('returns from composer-runtime-api', () => {
      expect(
        extractContraints({ require: { 'composer-runtime-api': '^1.1.0' } }, {})
      ).toEqual({ composer: '1.*' });
    });

    it('returns from plugin-api-version', () => {
      expect(extractContraints({}, { 'plugin-api-version': '1.1.0' })).toEqual({
        composer: '1.*',
      });
    });

    it('fallback to 1.*', () => {
      expect(extractContraints({}, {})).toEqual({ composer: '1.*' });
    });
  });
});
