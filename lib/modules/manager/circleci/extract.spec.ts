import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const file1 = Fixtures.get('config.yml');
const file2 = Fixtures.get('config2.yml');
const file3 = Fixtures.get('config3.yml');

describe('modules/manager/circleci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(file1);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(4);
    });

    it('extracts orbs too', () => {
      const res = extractPackageFile(file2);
      expect(res?.deps).toMatchObject([
        {
          depName: 'release-workflows',
          currentValue: '4.1.0',
          datasource: 'orb',
          depType: 'orb',
        },
        {
          depName: 'no-version',
          currentValue: undefined,
          datasource: 'orb',
          depType: 'orb',
        },
        {
          depName: 'volatile',
          currentValue: 'volatile',
          datasource: 'orb',
          depType: 'orb',
        },
        {},
        {},
        {},
        {},
        {},
        {},
      ]);
    });

    it('extracts image without leading dash', () => {
      const res = extractPackageFile(file3);
      expect(res?.deps).toMatchObject([
        { currentValue: '14.8.0', depName: 'cimg/node' },
      ]);
    });

    it('extracts and exclude android images', () => {
      expect(
        extractPackageFile(
          'jobs:\n' +
            '  build:\n' +
            '    machine:\n' +
            '      image: android:202102-01',
        ),
      ).toBeNull();
    });
  });
});
