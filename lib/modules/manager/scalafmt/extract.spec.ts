import { codeBlock } from 'common-tags';
import { fs } from '../../../../test/util';
import { extractAllPackageFiles } from './extract';

jest.mock('../../../util/fs');

describe('modules/manager/scalafmt/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts version correctly', async () => {
      const scalafmtConf = codeBlock`
      version = 3.8.0
    `;
      fs.readLocalFile.mockResolvedValueOnce(scalafmtConf);
      const packages = await extractAllPackageFiles({}, ['.scalafmt.conf']);
      expect(packages).toMatchObject([
        {
          deps: [
            {
              datasource: 'github-releases',
              packageName: 'scalameta/scalafmt',
              depName: 'scalameta/scalafmt',
              currentValue: '3.8.0',
              replaceString: 'version = 3.8.0',
              versioning: 'semver',
              extractVersion: '^v(?<version>\\S+)',
              registryUrls: [],
            },
          ],
        },
      ]);
    });

    it('ignore file if no version specified', async () => {
      const scalafmtConf = codeBlock`
      maxColumn = 80
    `;
      fs.readLocalFile.mockResolvedValueOnce(scalafmtConf);
      const packages = await extractAllPackageFiles({}, ['.scalafmt.conf']);
      expect(packages).toBeEmpty();
    });

    it('should return empty packagefiles is no content is provided', async () => {
      fs.readLocalFile.mockResolvedValueOnce('');
      const packages = await extractAllPackageFiles({}, ['.scalafmt.conf']);
      expect(packages).toBeEmpty();
    });
  });
});
