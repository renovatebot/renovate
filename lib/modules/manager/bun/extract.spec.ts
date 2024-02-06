import { fs } from '../../../../test/util';
import { extractAllPackageFiles } from './extract';

jest.mock('../../../util/fs');

describe('modules/manager/bun/extract', () => {
  describe('extractAllPackageFiles()', () => {
    it('ignores non-bun files', async () => {
      expect(await extractAllPackageFiles({}, ['package.json'])).toEqual([]);
    });

    it('ignores missing package.json file', async () => {
      expect(await extractAllPackageFiles({}, ['bun.lockb'])).toEqual([]);
    });

    it('ignores invalid package.json file', async () => {
      (fs.readLocalFile as jest.Mock).mockResolvedValueOnce('invalid');
      expect(await extractAllPackageFiles({}, ['bun.lockb'])).toEqual([]);
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
      expect(await extractAllPackageFiles({}, ['bun.lockb'])).toEqual([]);
    });

    it('parses valid package.json file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: {
            dep1: '1.0.0',
          },
        }),
      );
      expect(await extractAllPackageFiles({}, ['bun.lockb'])).toMatchObject([
        {
          deps: [
            {
              currentValue: '1.0.0',
              datasource: 'npm',
              depName: 'dep1',
              depType: 'dependencies',
              prettyDepType: 'dependency',
            },
          ],
          extractedConstraints: {},
          lockFiles: ['bun.lockb'],
          managerData: {
            hasPackageManager: false,
            packageJsonName: 'test',
          },
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
        },
      ]);
    });
  });
});
