import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const plackCpanfile = Fixtures.get('cpanfile.plack');
const datetimeCpanfile = Fixtures.get('cpanfile.datetime');
const test2Cpanfile = Fixtures.get('cpanfile.test2');
const dancer2Cpanfile = Fixtures.get('cpanfile.dancer2');

describe('modules/manager/cpanfile/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(await extractPackageFile('nothing here', 'cpanfile')).toBeNull();
    });

    it('parses Plack cpanfile', async () => {
      const res = await extractPackageFile(plackCpanfile, 'cpanfile');
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(41);
    });

    it('parse DateTime cpanfile', async () => {
      const res = await extractPackageFile(datetimeCpanfile, 'cpanfile');
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(71);
    });

    it('parse Test2 cpanfile', async () => {
      const res = await extractPackageFile(test2Cpanfile, 'cpanfile');
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(12);
    });

    it('parse Dancer2 cpanfile', async () => {
      const res = await extractPackageFile(dancer2Cpanfile, 'cpanfile');
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(86);
    });
  });
});
