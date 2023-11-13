import { Fixtures } from '../../../../../test/fixtures';
import { fs } from '../../../../../test/util';
import { logger } from '../../../../logger';
import type { ExtractConfig } from '../../types';
import { postExtract } from './post';
import * as npmExtract from '.';

jest.mock('../../../../util/fs');

const defaultExtractConfig = {
  skipInstalls: null,
} satisfies ExtractConfig;

const input01Content = Fixtures.get('inputs/01.json', '..');
const input02Content = Fixtures.get('inputs/02.json', '..');
const input01GlobContent = Fixtures.get('inputs/01-glob.json', '..');
const workspacesContent = Fixtures.get('inputs/workspaces.json', '..');
const vendorisedContent = Fixtures.get('is-object.json', '..');
const invalidNameContent = Fixtures.get('invalid-name.json', '..');

describe('modules/manager/npm/extract/index', () => {
  describe('.extractPackageFile()', () => {
    beforeEach(() => {
      const realFs = jest.requireActual<typeof fs>('../../../../util/fs');
      fs.readLocalFile.mockResolvedValue(null);
      fs.localPathExists.mockResolvedValue(false);
      fs.getSiblingFileName.mockImplementation(realFs.getSiblingFileName);
    });

    it('returns null if cannot parse', async () => {
      const res = await npmExtract.extractPackageFile(
        'not json',
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toBeNull();
    });

    it('catches invalid names', async () => {
      const res = await npmExtract.extractPackageFile(
        invalidNameContent,
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toMatchSnapshot({
        deps: [{ skipReason: 'invalid-name' }],
      });
    });

    it('ignores vendorised package.json', async () => {
      const res = await npmExtract.extractPackageFile(
        vendorisedContent,
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toBeNull();
    });

    it('throws error if non-root renovate config', async () => {
      await expect(
        npmExtract.extractPackageFile(
          '{ "renovate": {} }',
          'backend/package.json',
          defaultExtractConfig,
        ),
      ).rejects.toThrow();
    });

    it('returns null if no deps', async () => {
      const res = await npmExtract.extractPackageFile(
        '{ "renovate": {} }',
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toBeNull();
    });

    it('handles invalid', async () => {
      const res = await npmExtract.extractPackageFile(
        '{"dependencies": true, "devDependencies": []}',
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toBeNull();
    });

    it('returns an array of dependencies', async () => {
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        defaultExtractConfig,
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
        defaultExtractConfig,
      );
      expect(res?.deps).toHaveLength(13);
      expect(res).toMatchSnapshot({
        extractedConstraints: {},
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
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === 'yarn.lock') {
          return Promise.resolve('# yarn.lock');
        }
        return Promise.resolve(null);
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toMatchSnapshot({
        managerData: {
          yarnLock: 'yarn.lock',
        },
      });
    });

    it('warns when multiple lock files found', async () => {
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === 'yarn.lock') {
          return Promise.resolve('# yarn.lock');
        }
        if (fileName === 'package-lock.json') {
          return Promise.resolve('# package-lock.json');
        }
        return Promise.resolve(null);
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        defaultExtractConfig,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'Updating multiple npm lock files is deprecated and support will be removed in future versions.',
      );
      expect(res).toMatchObject({
        managerData: {
          npmLock: 'package-lock.json',
          yarnLock: 'yarn.lock',
        },
      });
    });

    it('finds and filters .npmrc', async () => {
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.npmrc') {
          return Promise.resolve('save-exact = true\npackage-lock = false\n');
        }
        return Promise.resolve(null);
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        {},
      );
      expect(res?.npmrc).toBe('save-exact = true\n');
    });

    it('uses config.npmrc if no .npmrc exists', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        { ...defaultExtractConfig, npmrc: 'config-npmrc' },
      );
      expect(res?.npmrc).toBe('config-npmrc');
    });

    it('uses config.npmrc if .npmrc does exist but npmrcMerge=false', async () => {
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.npmrc') {
          return Promise.resolve('repo-npmrc\n');
        }
        return Promise.resolve(null);
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        { npmrc: 'config-npmrc' },
      );
      expect(res?.npmrc).toBe('config-npmrc');
    });

    it('merges config.npmrc and repo .npmrc when npmrcMerge=true', async () => {
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.npmrc') {
          return Promise.resolve('repo-npmrc\n');
        }
        return Promise.resolve(null);
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        { npmrc: 'config-npmrc', npmrcMerge: true },
      );
      expect(res?.npmrc).toBe(`config-npmrc\nrepo-npmrc\n`);
    });

    it('finds and filters .npmrc with variables', async () => {
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.npmrc') {
          return Promise.resolve(
            'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}\n',
          );
        }
        return Promise.resolve(null);
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        {},
      );
      expect(res?.npmrc).toBe('registry=https://registry.npmjs.org\n');
    });

    it('reads registryUrls from .yarnrc.yml', async () => {
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.yarnrc.yml') {
          return Promise.resolve(
            'npmRegistryServer: https://registry.example.com',
          );
        }
        return Promise.resolve(null);
      });
      const res = await npmExtract.extractPackageFile(
        input02Content,
        'package.json',
        {},
      );
      expect(
        res?.deps.flatMap((dep) => dep.registryUrls),
      ).toBeArrayIncludingOnly(['https://registry.example.com']);
    });

    it('reads registryUrls from .yarnrc', async () => {
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.yarnrc') {
          return Promise.resolve('registry "https://registry.example.com"');
        }
        return Promise.resolve(null);
      });
      const res = await npmExtract.extractPackageFile(
        input02Content,
        'package.json',
        {},
      );
      expect(
        res?.deps.flatMap((dep) => dep.registryUrls),
      ).toBeArrayIncludingOnly(['https://registry.example.com']);
    });

    it('finds complex yarn workspaces', async () => {
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        return Promise.resolve(null);
      });
      const res = await npmExtract.extractPackageFile(
        workspacesContent,
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toMatchSnapshot({
        managerData: { workspacesPackages: ['packages/*'] },
      });
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
        defaultExtractConfig,
      );
      expect(res).toMatchSnapshot({
        extractedConstraints: {
          node: '>= 8.9.2',
          npm: '^8.0.0',
          pnpm: '^1.2.0',
          vscode: '>=1.49.3',
        },
        deps: [
          { depName: 'angular', currentValue: '1.6.0' },
          { depName: '@angular/cli', currentValue: '1.6.0' },
          { depName: 'foo', currentValue: '*' },
          {
            depName: 'bar',
            currentValue: 'file:../foo/bar',
            skipReason: 'file',
          },
          { depName: 'baz', currentValue: '', skipReason: 'empty' },
          {
            depName: 'other',
            currentValue: 'latest',
            skipReason: 'unspecified-version',
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
            skipReason: 'unspecified-version',
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
          invalid: '1.0.0',
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toMatchSnapshot({
        deps: [
          ...[{}, {}, {}, {}],
          {
            depType: 'volta',
            currentValue: '6.11.2',
            depName: 'pnpm',
            prettyDepType: 'volta',
          },
          {
            depType: 'volta',
            currentValue: '1.0.0',
            depName: 'invalid',
            prettyDepType: 'volta',
            skipReason: 'unknown-volta',
          },
        ],
      });
    });

    it('extracts volta yarn unspecified-version', async () => {
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
        defaultExtractConfig,
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
            packageName: 'nodejs/node',
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
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('extracts volta yarn higher than 1', async () => {
      const pJson = {
        main: 'index.js',
        engines: {
          node: '16.0.0',
        },
        volta: {
          node: '16.0.0',
          yarn: '3.2.4',
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultExtractConfig,
      );

      expect(res).toMatchObject({
        deps: [
          {},
          {
            commitMessageTopic: 'Node.js',
            currentValue: '16.0.0',
            datasource: 'github-tags',
            depName: 'node',
            depType: 'volta',
            packageName: 'nodejs/node',
            prettyDepType: 'volta',
            versioning: 'node',
          },
          {
            commitMessageTopic: 'Yarn',
            currentValue: '3.2.4',
            datasource: 'npm',
            depName: 'yarn',
            depType: 'volta',
            prettyDepType: 'volta',
            packageName: '@yarnpkg/cli',
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
          p: 'Owner/P.git#v2.0.0',
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toMatchSnapshot({
        deps: [
          { depName: 'a', skipReason: 'unspecified-version' },
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
            skipReason: 'unspecified-version',
          },
          {
            depName: 'h',
            currentValue: 'github:-hello/world#v1.0.0',
            skipReason: 'unspecified-version',
          },
          {
            depName: 'i',
            currentValue: '@foo/bar#v2.0.0',
            skipReason: 'unspecified-version',
          },
          {
            depName: 'j',
            currentValue: 'github:frank#v0.0.1',
            skipReason: 'unspecified-version',
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
          {
            depName: 'p',
            currentValue: 'v2.0.0',
            datasource: 'github-tags',
            sourceUrl: 'https://github.com/Owner/P',
          },
        ],
      });
    });

    it('does not set registryUrls for non-npmjs', async () => {
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.yarnrc.yml') {
          return Promise.resolve(
            'npmRegistryServer: https://registry.example.com',
          );
        }
        return Promise.resolve(null);
      });
      const pJson = {
        dependencies: {
          a: 'github:owner/a#v1.1.0',
        },
        engines: {
          node: '8.9.2',
        },
        volta: {
          yarn: '3.2.4',
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toMatchObject({
        deps: [
          {
            depName: 'a',
            currentValue: 'v1.1.0',
            datasource: 'github-tags',
            sourceUrl: 'https://github.com/owner/a',
          },
          {
            commitMessageTopic: 'Node.js',
            currentValue: '8.9.2',
            datasource: 'github-tags',
            depName: 'node',
            depType: 'engines',
            packageName: 'nodejs/node',
            prettyDepType: 'engine',
            versioning: 'node',
          },
          {
            commitMessageTopic: 'Yarn',
            currentValue: '3.2.4',
            datasource: 'npm',
            depName: 'yarn',
            depType: 'volta',
            prettyDepType: 'volta',
            packageName: '@yarnpkg/cli',
          },
        ],
      });
    });

    it('extracts npm package alias', async () => {
      fs.readLocalFile.mockImplementation((fileName: string): Promise<any> => {
        if (fileName === 'package-lock.json') {
          return Promise.resolve('{}');
        }
        return Promise.resolve(null);
      });
      const pJson = {
        dependencies: {
          a: 'npm:foo@1',
          b: 'npm:@foo/bar@1.2.3',
          c: 'npm:^1.2.3',
          d: 'npm:1.2.3',
          e: 'npm:1.x.x',
          f: 'npm:foo',
          g: 'npm:@foo/@bar/@1.2.3',
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultExtractConfig,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Invalid npm package alias for dependency: "g":"npm:@foo/@bar/@1.2.3"',
      );
      expect(res).toMatchSnapshot({
        deps: [
          { packageName: 'foo' },
          { packageName: '@foo/bar' },
          { packageName: 'c', currentValue: '^1.2.3' },
          { packageName: 'd', currentValue: '1.2.3' },
          { packageName: 'e', currentValue: '1.x.x' },
          {
            packageName: 'f',
            currentValue: 'foo',
            npmPackageAlias: true,
            skipReason: 'unspecified-version',
          },
          {
            depName: 'g',
            currentValue: 'npm:@foo/@bar/@1.2.3',
            npmPackageAlias: true,
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('sets skipInstalls false if Yarn zero-install is used', async () => {
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === 'yarn.lock') {
          return Promise.resolve('# yarn.lock');
        }
        if (fileName === '.yarnrc.yml') {
          return Promise.resolve('pnpEnableInlining: false');
        }
        return Promise.resolve(null);
      });
      fs.localPathExists.mockResolvedValueOnce(true);
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        defaultExtractConfig,
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
        defaultExtractConfig,
      );
      expect(res).toMatchSnapshot({
        extractedConstraints: { yarn: '3.0.0' },
        deps: [
          {
            commitMessageTopic: 'Yarn',
            currentValue: '3.0.0',
            datasource: 'npm',
            depName: 'yarn',
            depType: 'packageManager',
            packageName: '@yarnpkg/cli',
            prettyDepType: 'packageManager',
          },
        ],
      });
    });

    it('extracts dependencies from overrides', async () => {
      const content = `{
        "devDependencies": {
          "@types/react": "18.0.5"
        },
        "overrides": {
          "node": "8.9.2",
          "@types/react": "18.0.5",
          "baz": {
            "node": "8.9.2",
            "bar": {
              "foo": "1.0.0"
            }
          },
          "foo2": {
            ".": "1.0.0",
            "bar2": "1.0.0"
          },
          "emptyObject":{}
        }
      }`;
      const res = await npmExtract.extractPackageFile(
        content,
        'package.json',
        defaultExtractConfig,
      );
      expect(res).toMatchObject({
        deps: [
          {
            depType: 'devDependencies',
            depName: '@types/react',
            currentValue: '18.0.5',
            datasource: 'npm',
            prettyDepType: 'devDependency',
          },
          {
            depType: 'overrides',
            depName: 'node',
            currentValue: '8.9.2',
            datasource: 'npm',
            commitMessageTopic: 'Node.js',
            prettyDepType: 'overrides',
          },
          {
            depType: 'overrides',
            depName: '@types/react',
            currentValue: '18.0.5',
            datasource: 'npm',
            prettyDepType: 'overrides',
          },
          {
            depName: 'node',
            managerData: { parents: ['baz'] },
            commitMessageTopic: 'Node.js',
            currentValue: '8.9.2',
            datasource: 'npm',
          },
          {
            depName: 'foo',
            managerData: { parents: ['baz', 'bar'] },
            currentValue: '1.0.0',
            datasource: 'npm',
          },
          {
            depName: 'foo2',
            managerData: { parents: ['foo2'] },
            currentValue: '1.0.0',
            datasource: 'npm',
          },
          {
            depName: 'bar2',
            managerData: { parents: ['foo2'] },
            currentValue: '1.0.0',
            datasource: 'npm',
          },
        ],
      });
    });
  });

  describe('.extractAllPackageFiles()', () => {
    it('runs', async () => {
      fs.readLocalFile.mockResolvedValueOnce(input02Content);
      const res = await npmExtract.extractAllPackageFiles(
        defaultExtractConfig,
        ['package.json'],
      );
      expect(res).toEqual([
        {
          deps: [
            {
              currentValue: '7.0.0',
              datasource: 'npm',
              depName: '@babel/core',
              depType: 'dependencies',
              prettyDepType: 'dependency',
            },
            {
              currentValue: '1.21.0',
              datasource: 'npm',
              depName: 'config',
              depType: 'dependencies',
              prettyDepType: 'dependency',
            },
          ],
          extractedConstraints: {},
          managerData: {
            hasPackageManager: false,
            npmLock: undefined,
            packageJsonName: 'renovate',
            pnpmShrinkwrap: undefined,
            workspacesPackages: undefined,
            yarnLock: undefined,
            yarnZeroInstall: false,
          },
          npmrc: undefined,
          packageFile: 'package.json',
          packageFileVersion: '1.0.0',
          skipInstalls: true,
        },
      ]);
    });
  });

  describe('.postExtract()', () => {
    it('runs', async () => {
      await expect(postExtract([])).resolves.not.toThrow();
    });
  });
});
