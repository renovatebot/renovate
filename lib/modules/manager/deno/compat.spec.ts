import { fs } from '../../../../test/util';
import { extractDenoCompatiblePackageJson } from './compat';

vi.mock('../../../util/fs');

describe('modules/manager/deno/compat', () => {
  describe('extractDenoCompatiblePackageJson()', () => {
    it('not supported remote datasource in package.json', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: {
            r: 'github:owner/r#semver:^1.0.0',
            n: 'git+https://github.com/owner/n#v2.0.0',
          },
        }),
      );
      const result = await extractDenoCompatiblePackageJson('package.json');
      expect(result).toEqual({
        deps: [
          {
            currentRawValue: 'github:owner/r#semver:^1.0.0',
            currentValue: '^1.0.0',
            datasource: 'github-tags',
            depName: 'r',
            depType: 'dependencies',
            gitRef: true,
            packageName: 'owner/r',
            pinDigests: false,
            prettyDepType: 'dependency',
            skipReason: 'unsupported-remote',
            sourceUrl: 'https://github.com/owner/r',
            versioning: 'npm',
          },
          {
            currentRawValue: 'git+https://github.com/owner/n#v2.0.0',
            currentValue: 'v2.0.0',
            datasource: 'github-tags',
            depName: 'n',
            depType: 'dependencies',
            gitRef: true,
            packageName: 'owner/n',
            pinDigests: false,
            prettyDepType: 'dependency',
            skipReason: 'unsupported-remote',
            sourceUrl: 'https://github.com/owner/n',
            versioning: 'npm',
          },
        ],
        extractedConstraints: {},
        managerData: {
          packageName: 'test',
          workspaces: undefined,
        },
        packageFile: 'package.json',
        packageFileVersion: '0.0.1',
      });
    });

    it('invalid package.json', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce('invalid');
      const result = await extractDenoCompatiblePackageJson('package.json');
      expect(result).toBeNull();
    });

    it('handles null response', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        // This package.json returns null from the extractor
        JSON.stringify({
          _id: 1,
          _args: 1,
          _from: 1,
        }),
      );
      const result = await extractDenoCompatiblePackageJson('package.json');
      expect(result).toBeNull();
    });
  });
});
