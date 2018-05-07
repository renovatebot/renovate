const fs = require('fs');
const path = require('path');
const npmExtract = require('../../../../lib/manager/npm/extract');

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../../_fixtures/package-json/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('inputs/01.json');

describe('manager/npm/extract', () => {
  describe('.extractDependencies()', () => {
    beforeEach(() => {
      platform.getFile.mockReturnValue(null);
    });
    it('returns null if cannot parse', async () => {
      const res = await npmExtract.extractDependencies(
        'not json',
        'package.json'
      );
      expect(res).toBe(null);
    });
    it('returns null if no deps', async () => {
      const res = await npmExtract.extractDependencies('{}', 'package.json');
      expect(res).toBe(null);
    });
    it('handles invalid', async () => {
      const res = await npmExtract.extractDependencies(
        '{"dependencies": true, "devDependencies": []}',
        'package.json'
      );
      expect(res).toBe(null);
    });
    it('returns an array of dependencies', async () => {
      const res = await npmExtract.extractDependencies(
        input01Content,
        'package.json'
      );
      expect(res).toMatchSnapshot();
    });
    it('finds a lock file', async () => {
      platform.getFile = jest.fn(fileName => {
        if (fileName === 'yarn.lock') {
          return '# yarn.lock';
        }
        return null;
      });
      const res = await npmExtract.extractDependencies(
        input01Content,
        'package.json'
      );
      expect(res).toMatchSnapshot();
    });
    it('finds lerna', async () => {
      platform.getFile = jest.fn(fileName => {
        if (fileName === 'lerna.json') {
          return '{}';
        }
        return null;
      });
      const res = await npmExtract.extractDependencies(
        input01Content,
        'package.json'
      );
      expect(res).toMatchSnapshot();
    });
  });
  describe('.postExtract()', () => {
    beforeEach(() => {
      platform.getFile.mockReturnValue(null);
    });
    it('handles no monorepo', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
        },
      ];
      await npmExtract.postExtract(packageFiles);
      expect(packageFiles).toMatchSnapshot();
    });
    it('uses lerna package settings', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          lernaDir: '.',
          lernaPackages: ['packages/*'],
        },
        {
          packageFile: 'packages/a/package.json',
          packageJsonName: '@org/a',
        },
        {
          packageFile: 'packages/b/package.json',
          packageJsonName: '@org/b',
        },
      ];
      await npmExtract.postExtract(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].lernaDir).toEqual('.');
      expect(packageFiles[1].monorepoPackages).toEqual(['@org/b']);
    });
    it('uses yarn workspaces package settings', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          lernaDir: '.',
          lernaPackages: ['oldpackages/*'],
          lernaClient: 'yarn',
          yarnWorkspacesPackages: ['packages/*'],
        },
        {
          packageFile: 'packages/a/package.json',
          packageJsonName: '@org/a',
        },
        {
          packageFile: 'packages/b/package.json',
          packageJsonName: '@org/b',
        },
      ];
      await npmExtract.postExtract(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].lernaDir).toEqual('.');
      expect(packageFiles[1].monorepoPackages).toEqual(['@org/b']);
    });
  });
});
