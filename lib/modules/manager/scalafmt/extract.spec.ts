import { codeBlock } from 'common-tags';
import { extractPackageFile } from './extract';

describe('modules/manager/scalafmt/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts version correctly', () => {
      const scalafmtConf = codeBlock`
      version = 3.8.0
    `;
      const packages = extractPackageFile(scalafmtConf);
      expect(packages).toMatchObject({
        deps: [
          {
            datasource: 'github-releases',
            packageName: 'scalameta/scalafmt',
            depName: 'scalafmt',
            currentValue: '3.8.0',
            versioning: 'semver',
            extractVersion: '^v(?<version>\\S+)',
          },
        ],
      });
    });

    it('ignore file if no version specified', () => {
      const scalafmtConf = codeBlock`
      maxColumn = 80
    `;
      const packages = extractPackageFile(scalafmtConf);
      expect(packages).toBeNull();
    });

    it('should return empty packagefiles is no content is provided', () => {
      const packages = extractPackageFile('');
      expect(packages).toBeNull();
    });
  });
});
