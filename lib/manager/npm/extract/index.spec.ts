import { loadFixture } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import * as _fs from '../../../util/fs';
import * as npmExtract from '.';

const fs: any = _fs;

// TODO: fix types
const defaultConfig = getConfig();

const input01Content = loadFixture('inputs/01.json', '..');
const input01GlobContent = loadFixture('inputs/01-glob.json', '..');
const workspacesContent = loadFixture('inputs/workspaces.json', '..');
const workspacesSimpleContent = loadFixture(
  'inputs/workspaces-simple.json',
  '..'
);
const vendorisedContent = loadFixture('is-object.json', '..');
const invalidNameContent = loadFixture('invalid-name.json', '..');

describe('manager/npm/extract/index', () => {
  describe('.extractPackageFile()', () => {
    beforeEach(() => {
      fs.readLocalFile = jest.fn(() => null);
      fs.localPathExists = jest.fn(() => false);
    });
    it('returns null if cannot parse', async () => {
      const res = await npmExtract.extractPackageFile(
        'not json',
        'package.json',
        defaultConfig
      );
      expect(res).toBeNull();
    });
    it('catches invalid names', async () => {
      const res = await npmExtract.extractPackageFile(
        invalidNameContent,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        deps: [{ skipReason: 'invalid-name' }],
      });
    });
    it('ignores vendorised package.json', async () => {
      const res = await npmExtract.extractPackageFile(
        vendorisedContent,
        'package.json',
        defaultConfig
      );
      expect(res).toBeNull();
    });
    it('throws error if non-root renovate config', async () => {
      await expect(
        npmExtract.extractPackageFile(
          '{ "renovate": {} }',
          'backend/package.json',
          defaultConfig
        )
      ).rejects.toThrow();
    });
    it('returns null if no deps', async () => {
      const res = await npmExtract.extractPackageFile(
        '{ "renovate": {} }',
        'package.json',
        defaultConfig
      );
      expect(res).toBeNull();
    });
    it('handles invalid', async () => {
      const res = await npmExtract.extractPackageFile(
        '{"dependencies": true, "devDependencies": []}',
        'package.json',
        defaultConfig
      );
      expect(res).toBeNull();
    });
    it('returns an array of dependencies', async () => {
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        deps: [
          { depName: 'autoprefixer', currentValue: '6.5.0' },
          { depName: 'bower', currentValue: '~1.6.0' },
          { depName: 'browserify', currentValue: '13.1.0' },
          { depName: 'browserify-css', currentValue: '0.9.2' },
          { depName: 'cheerio', currentValue: '=0.22.0' },
          { depName: 'config', currentValue: '1.21.0' },
          { depName: 'enabled', skipReason: 'invalid-value' },
          { depName: 'angular', currentValue: '^1.5.8' },
          { depName: 'angular-touch', currentValue: '1.5.8' },
          { depName: 'angular-sanitize', currentValue: '1.5.8' },
          { depName: '@angular/core', currentValue: '4.0.0-beta.1' },
          { depName: 'config', currentValue: '1.21.0' },
          { depName: '@angular/cli', currentValue: '8.0.0' },
          { depName: 'angular', currentValue: '1.33.0' },
          { depName: 'glob', currentValue: '1.0.0' },
        ],
      });
    });
    it('returns an array of dependencies with resolution comments', async () => {
      const res = await npmExtract.extractPackageFile(
        input01GlobContent,
        'package.json',
        defaultConfig
      );
      expect(res?.deps).toHaveLength(13);
      expect(res).toMatchSnapshot({
        constraints: {},
        deps: [
          ...[{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
          {
            depName: undefined,
            depType: 'resolutions',
            managerData: { key: '//' },
            prettyDepType: 'resolutions',
            skipReason: 'invalid-name',
          },
          {
            depName: 'config',
            currentValue: '1.21.0',
            depType: 'resolutions',
            managerData: { key: '**/config' },
            prettyDepType: 'resolutions',
          },
        ],
      });
    });
    it('finds a lock file', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === 'yarn.lock') {
          return '# yarn.lock';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({ yarnLock: 'yarn.lock' });
    });
    it('finds and filters .npmrc', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === '.npmrc') {
          return 'save-exact = true\npackage-lock = false\n';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        {}
      );
      expect(res.npmrc).toBeDefined();
    });
    it('ignores .npmrc when config.npmrc is defined and npmrcMerge=false', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === '.npmrc') {
          return 'some-npmrc\n';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        { npmrc: 'some-configured-npmrc' }
      );
      expect(res.npmrc).toBeUndefined();
    });
    it('reads .npmrc when config.npmrc is merged', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === '.npmrc') {
          return 'repo-npmrc\n';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        { npmrc: 'config-npmrc', npmrcMerge: true }
      );
      expect(res.npmrc).toBe(`config-npmrc\nrepo-npmrc\n`);
    });
    it('finds and filters .npmrc with variables', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === '.npmrc') {
          return 'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}\n';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        {}
      );
      expect(res.npmrc).toBe('registry=https://registry.npmjs.org\n');
    });
    it('finds lerna', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === 'lerna.json') {
          return '{}';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        lernaClient: 'npm',
        lernaPackages: undefined,
        managerData: { lernaJsonFile: 'lerna.json' },
      });
    });
    it('finds "npmClient":"npm" in lerna.json', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === 'lerna.json') {
          return '{ "npmClient": "npm" }';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        lernaClient: 'npm',
        lernaPackages: undefined,
        managerData: { lernaJsonFile: 'lerna.json' },
      });
    });
    it('finds "npmClient":"yarn" in lerna.json', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === 'lerna.json') {
          return '{ "npmClient": "yarn" }';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        lernaClient: 'yarn',
        lernaPackages: undefined,
        managerData: { lernaJsonFile: 'lerna.json' },
      });
    });
    it('finds simple yarn workspaces', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === 'lerna.json') {
          return '{}';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        workspacesSimpleContent,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({ yarnWorkspacesPackages: ['packages/*'] });
    });
    it('finds simple yarn workspaces with lerna.json and useWorkspaces: true', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === 'lerna.json') {
          return '{"useWorkspaces": true}';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        workspacesSimpleContent,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({ yarnWorkspacesPackages: ['packages/*'] });
    });
    it('finds complex yarn workspaces', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === 'lerna.json') {
          return '{}';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        workspacesContent,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({ yarnWorkspacesPackages: ['packages/*'] });
    });
    it('extracts engines', async () => {
      const pJson = {
        dependencies: {
          angular: '1.6.0',
        },
        devDependencies: {
          '@angular/cli': '1.6.0',
          foo: '*',
          bar: 'file:../foo/bar',
          baz: '',
          other: 'latest',
        },
        engines: {
          atom: '>=1.7.0 <2.0.0',
          node: '>= 8.9.2',
          npm: '^8.0.0',
          pnpm: '^1.2.0',
          yarn: 'disabled',
          vscode: '>=1.49.3',
        },
        main: 'index.js',
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        constraints: {
          node: '>= 8.9.2',
          npm: '^8.0.0',
          pnpm: '^1.2.0',
          vscode: '>=1.49.3',
          yarn: 'disabled',
        },
        deps: [
          { depName: 'angular', currentValue: '1.6.0' },
          { depName: '@angular/cli', currentValue: '1.6.0' },
          { depName: 'foo', currentValue: '*', skipReason: 'any-version' },
          {
            depName: 'bar',
            currentValue: 'file:../foo/bar',
            skipReason: 'file',
          },
          { depName: 'baz', currentValue: '', skipReason: 'empty' },
          {
            depName: 'other',
            currentValue: 'latest',
            skipReason: 'unknown-version',
          },
          {
            depName: 'atom',
            currentValue: '>=1.7.0 <2.0.0',
            skipReason: 'unknown-engines',
            depType: 'engines',
          },
          {
            depName: 'node',
            currentValue: '>= 8.9.2',
            datasource: 'github-tags',
            versioning: 'node',
            depType: 'engines',
          },
          {
            depName: 'npm',
            currentValue: '^8.0.0',
            datasource: 'npm',
            depType: 'engines',
          },
          {
            depName: 'pnpm',
            currentValue: '^1.2.0',
            datasource: 'npm',
            depType: 'engines',
          },
          {
            depName: 'yarn',
            currentValue: 'disabled',
            datasource: 'npm',
            depType: 'engines',
            skipReason: 'unknown-version',
          },
          {
            depName: 'vscode',
            currentValue: '>=1.49.3',
            depType: 'engines',
            datasource: 'github-tags',
          },
        ],
      });
    });
    it('extracts volta', async () => {
      const pJson = {
        main: 'index.js',
        engines: {
          node: '8.9.2',
        },
        volta: {
          node: '8.9.2',
          yarn: '1.12.3',
          npm: '5.9.0',
          pnpm: '6.11.2',
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        deps: [
          ...[{}, {}, {}, {}],
          {
            depType: 'volta',
            currentValue: '6.11.2',
            depName: 'pnpm',
            prettyDepType: 'volta',
            skipReason: 'unknown-volta',
          },
        ],
      });
    });

    it('extracts volta yarn unknown-version', async () => {
      const pJson = {
        main: 'index.js',
        engines: {
          node: '8.9.2',
        },
        volta: {
          node: '8.9.2',
          yarn: 'unknown',
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        deps: [
          {},
          {
            commitMessageTopic: 'Node.js',
            currentValue: '8.9.2',
            datasource: 'github-tags',
            depName: 'node',
            depType: 'volta',
            lookupName: 'nodejs/node',
            prettyDepType: 'volta',
            versioning: 'node',
          },
          {
            commitMessageTopic: 'Yarn',
            currentValue: 'unknown',
            datasource: 'npm',
            depName: 'yarn',
            depType: 'volta',
            prettyDepType: 'volta',
            skipReason: 'unknown-version',
          },
        ],
      });
    });
    it('extracts non-npmjs', async () => {
      const pJson = {
        dependencies: {
          a: 'github:owner/a',
          b: 'github:owner/b#master',
          c: 'github:owner/c#v1.1.0',
          d: 'github:owner/d#a7g3eaf',
          e: 'github:owner/e#49b5aca613b33c5b626ae68c03a385f25c142f55',
          f: 'owner/f#v2.0.0',
          g: 'gitlab:owner/g#v1.0.0',
          h: 'github:-hello/world#v1.0.0',
          i: '@foo/bar#v2.0.0',
          j: 'github:frank#v0.0.1',
          k: 'github:owner/k#49b5aca',
          l: 'github:owner/l.git#abcdef0',
          m: 'https://github.com/owner/m.git#v1.0.0',
          n: 'git+https://github.com/owner/n#v2.0.0',
          o: 'git@github.com:owner/o.git#v2.0.0',
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        deps: [
          { depName: 'a', skipReason: 'unknown-version' },
          { depName: 'b', skipReason: 'unversioned-reference' },
          {
            depName: 'c',
            currentValue: 'v1.1.0',
            datasource: 'github-tags',
            sourceUrl: 'https://github.com/owner/c',
          },
          {
            depName: 'd',
            currentValue: 'github:owner/d#a7g3eaf',
            skipReason: 'unversioned-reference',
          },
          {
            depName: 'e',
            currentValue: null,
            currentDigest: '49b5aca613b33c5b626ae68c03a385f25c142f55',
            datasource: 'github-tags',
            sourceUrl: 'https://github.com/owner/e',
          },
          {
            depName: 'f',
            currentValue: 'v2.0.0',
            datasource: 'github-tags',
            sourceUrl: 'https://github.com/owner/f',
          },
          {
            depName: 'g',
            currentValue: 'gitlab:owner/g#v1.0.0',
            skipReason: 'unknown-version',
          },
          {
            depName: 'h',
            currentValue: 'github:-hello/world#v1.0.0',
            skipReason: 'unknown-version',
          },
          {
            depName: 'i',
            currentValue: '@foo/bar#v2.0.0',
            skipReason: 'unknown-version',
          },
          {
            depName: 'j',
            currentValue: 'github:frank#v0.0.1',
            skipReason: 'unknown-version',
          },
          {
            depName: 'k',
            currentValue: null,
            currentDigest: '49b5aca',
            currentRawValue: 'github:owner/k#49b5aca',
            datasource: 'github-tags',
            sourceUrl: 'https://github.com/owner/k',
          },
          {
            depName: 'l',
            currentValue: null,
            currentDigest: 'abcdef0',
            currentRawValue: 'github:owner/l.git#abcdef0',
            datasource: 'github-tags',
            sourceUrl: 'https://github.com/owner/l',
          },
          {
            depName: 'm',
            currentValue: 'v1.0.0',
            currentRawValue: 'https://github.com/owner/m.git#v1.0.0',
            datasource: 'github-tags',
            sourceUrl: 'https://github.com/owner/m',
          },
          {
            depName: 'n',
            currentValue: 'v2.0.0',
            datasource: 'github-tags',
            sourceUrl: 'https://github.com/owner/n',
          },
          {
            depName: 'o',
            currentValue: 'v2.0.0',
            datasource: 'github-tags',
            sourceUrl: 'https://github.com/owner/o',
          },
        ],
      });
    });
    it('extracts npm package alias', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === 'package-lock.json') {
          return '{}';
        }
        return null;
      });
      const pJson = {
        dependencies: {
          a: 'npm:foo@1',
          b: 'npm:@foo/bar@1.2.3',
          c: 'npm:foo',
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        deps: [
          { lookupName: 'foo' },
          { lookupName: '@foo/bar' },
          { depName: 'c' },
        ],
      });
    });

    it('sets skipInstalls false if Yarn zero-install is used', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === 'yarn.lock') {
          return '# yarn.lock';
        }
        if (fileName === '.yarnrc.yml') {
          return 'pnpEnableInlining: false';
        }
        return null;
      });
      fs.localPathExists = jest.fn(() => true);
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot();
    });

    it('extracts packageManager', async () => {
      const pJson = {
        packageManager: 'yarn@3.0.0',
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot({
        constraints: { yarn: '3.0.0' },
        deps: [
          {
            commitMessageTopic: 'Yarn',
            currentValue: '3.0.0',
            datasource: 'npm',
            depName: 'yarn',
            depType: 'packageManager',
            lookupName: '@yarnpkg/cli',
            prettyDepType: 'packageManager',
          },
        ],
      });
    });
  });
  describe('.postExtract()', () => {
    it('runs', async () => {
      await expect(npmExtract.postExtract([], false)).resolves.not.toThrow();
    });
  });
});
