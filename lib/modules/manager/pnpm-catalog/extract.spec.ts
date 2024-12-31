import { fs } from '../../../../test/util';
import { extractAllPackageFiles } from './extract';

jest.mock('../../../util/fs');

describe('modules/manager/pnpm-catalog/extract', () => {
  describe('extractAllPackageFiles()', () => {
    it('ignores non pnpm-workspace.yaml files', async () => {
      expect(await extractAllPackageFiles({}, ['package.json'])).toEqual([]);
    });

    it('ignores invalid pnpm-workspace.yaml file', async () => {
      fs.readLocalFile.mockResolvedValueOnce('invalid');
      expect(await extractAllPackageFiles({}, ['pnpm-workspace.yaml'])).toEqual(
        [],
      );
    });

    it('handles empty catalog', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
catalog:
catalogs:
`);
      expect(await extractAllPackageFiles({}, ['pnpm-workspace.yaml'])).toEqual(
        [],
      );
    });

    it('parses valid pnpm-workspace.yaml file', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        `
catalog:
  react: 18.3.0

catalogs:
  react17:
    react: 17.0.2
`,
      );
      expect(
        await extractAllPackageFiles({}, ['pnpm-workspace.yaml']),
      ).toMatchObject([
        {
          deps: [
            {
              currentValue: '18.3.0',
              datasource: 'npm',
              depName: 'react',
              depType: 'catalogDependency',
              prettyDepType: 'catalogDependency',
              managerData: {
                catalogType: 'default',
                catalogName: 'default',
              },
            },
            {
              currentValue: '17.0.2',
              datasource: 'npm',
              depName: 'react',
              depType: 'catalogDependency',
              prettyDepType: 'catalogDependency',
              managerData: {
                catalogType: 'name',
                catalogName: 'react17',
              },
            },
          ],
          lockFiles: ['pnpm-workspace.yaml'],
          packageFile: 'pnpm-workspace.yaml',
        },
      ]);
    });
  });
});
