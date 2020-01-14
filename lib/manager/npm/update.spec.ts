import fs from 'fs';
import path from 'path';
import * as npmUpdater from './update';

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `./__fixtures__/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('inputs/01.json');
const input01GlobContent = readFixture('inputs/01-glob.json');

describe('workers/branch/package-json', () => {
  describe('.updateDependency(fileContent, depType, depName, newValue)', () => {
    it('replaces a dependency value', () => {
      const updateOptions = {
        depType: 'dependencies',
        depName: 'cheerio',
        newValue: '0.22.1',
      };
      const outputContent = readFixture('outputs/011.json');
      const testContent = npmUpdater.updateDependency({
        fileContent: input01Content,
        updateOptions,
      });
      expect(testContent).toEqual(outputContent);
    });
    it('replaces a github dependency value', () => {
      const updateOptions = {
        depType: 'dependencies',
        depName: 'gulp',
        currentValue: 'v4.0.0-alpha.2',
        currentRawValue: 'gulpjs/gulp#v4.0.0-alpha.2',
        newValue: 'v4.0.0',
      };
      const input = JSON.stringify({
        dependencies: {
          gulp: 'gulpjs/gulp#v4.0.0-alpha.2',
        },
      });
      const res = npmUpdater.updateDependency({
        fileContent: input,
        updateOptions,
      });
      expect(res).toMatchSnapshot();
    });
    it('replaces a npm package alias', () => {
      const updateOptions = {
        depType: 'dependencies',
        depName: 'hapi',
        npmPackageAlias: true,
        lookupName: '@hapi/hapi',
        currentValue: '18.3.0',
        newValue: '18.3.1',
      };
      const input = JSON.stringify({
        dependencies: {
          hapi: 'npm:@hapi/hapi@18.3.0',
        },
      });
      const res = npmUpdater.updateDependency({
        fileContent: input,
        updateOptions,
      });
      expect(res).toMatchSnapshot();
    });
    it('replaces a github short hash', () => {
      const updateOptions = {
        depType: 'dependencies',
        depName: 'gulp',
        currentDigest: 'abcdef7',
        currentRawValue: 'gulpjs/gulp#abcdef7',
        newDigest: '0000000000111111111122222222223333333333',
      };
      const input = JSON.stringify({
        dependencies: {
          gulp: 'gulpjs/gulp#abcdef7',
        },
      });
      const res = npmUpdater.updateDependency({
        fileContent: input,
        updateOptions,
      });
      expect(res).toMatchSnapshot();
    });
    it('replaces a github fully specified version', () => {
      const updateOptions = {
        depType: 'dependencies',
        depName: 'n',
        currentValue: 'v1.0.0',
        currentRawValue: 'git+https://github.com/owner/n#v1.0.0',
        newValue: 'v1.1.0',
      };
      const input = JSON.stringify({
        dependencies: {
          n: 'git+https://github.com/owner/n#v1.0.0',
        },
      });
      const res = npmUpdater.updateDependency({
        fileContent: input,
        updateOptions,
      });
      expect(res).toMatchSnapshot();
      expect(res.includes('v1.1.0')).toBe(true);
    });
    it('updates resolutions too', () => {
      const updateOptions = {
        depType: 'dependencies',
        depName: 'config',
        newValue: '1.22.0',
      };
      const testContent = npmUpdater.updateDependency({
        fileContent: input01Content,
        updateOptions,
      });
      expect(JSON.parse(testContent).dependencies.config).toEqual('1.22.0');
      expect(JSON.parse(testContent).resolutions.config).toEqual('1.22.0');
    });
    it('updates glob resolutions', () => {
      const updateOptions = {
        depType: 'dependencies',
        depName: 'config',
        newValue: '1.22.0',
      };
      const testContent = npmUpdater.updateDependency({
        fileContent: input01GlobContent,
        updateOptions,
      });
      expect(JSON.parse(testContent).dependencies.config).toEqual('1.22.0');
      expect(JSON.parse(testContent).resolutions['**/config']).toEqual(
        '1.22.0'
      );
    });
    it('replaces only the first instance of a value', () => {
      const updateOptions = {
        depType: 'devDependencies',
        depName: 'angular-touch',
        newValue: '1.6.1',
      };
      const outputContent = readFixture('outputs/012.json');
      const testContent = npmUpdater.updateDependency({
        fileContent: input01Content,
        updateOptions,
      });
      expect(testContent).toEqual(outputContent);
    });
    it('replaces only the second instance of a value', () => {
      const updateOptions = {
        depType: 'devDependencies',
        depName: 'angular-sanitize',
        newValue: '1.6.1',
      };
      const outputContent = readFixture('outputs/013.json');
      const testContent = npmUpdater.updateDependency({
        fileContent: input01Content,
        updateOptions,
      });
      expect(testContent).toEqual(outputContent);
    });
    it('handles the case where the desired version is already supported', () => {
      const updateOptions = {
        depType: 'devDependencies',
        depName: 'angular-touch',
        newValue: '1.5.8',
      };
      const testContent = npmUpdater.updateDependency({
        fileContent: input01Content,
        updateOptions,
      });
      expect(testContent).toEqual(input01Content);
    });
    it('returns null if throws error', () => {
      const updateOptions = {
        depType: 'blah',
        depName: 'angular-touch-not',
        newValue: '1.5.8',
      };
      const testContent = npmUpdater.updateDependency({
        fileContent: input01Content,
        updateOptions,
      });
      expect(testContent).toBeNull();
    });
  });
  describe('.bumpPackageVersion()', () => {
    const content = JSON.stringify({
      name: 'some-package',
      version: '0.0.2',
      dependencies: { chalk: '2.4.2' },
    });
    it('mirrors', () => {
      const res = npmUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        'mirror:chalk'
      );
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('aborts mirror', () => {
      const res = npmUpdater.bumpPackageVersion(content, '0.0.2', 'mirror:a');
      expect(res).toEqual(content);
    });
    it('increments', () => {
      const res = npmUpdater.bumpPackageVersion(content, '0.0.2', 'patch');
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('no ops', () => {
      const res = npmUpdater.bumpPackageVersion(content, '0.0.1', 'patch');
      expect(res).toEqual(content);
    });
    it('updates', () => {
      const res = npmUpdater.bumpPackageVersion(content, '0.0.1', 'minor');
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('returns content if bumping errors', async () => {
      jest.mock('semver', () => ({
        inc: () => {
          throw new Error('semver inc');
        },
      }));
      const npmUpdater1 = await import('./update');
      const res = npmUpdater1.bumpPackageVersion(content, '0.0.2', true as any);
      expect(res).toEqual(content);
    });
  });
});
