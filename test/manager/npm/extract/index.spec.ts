import fs from 'fs';
import path from 'path';
import * as npmExtract from '../../../../lib/manager/npm/extract';
import { getConfig } from '../../../../lib/config/defaults';
import { platform as _platform } from '../../../../lib/platform';

// TODO: fix types
const defaultConfig = getConfig() as any;
const platform: any = _platform;

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../_fixtures/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('inputs/01.json');
const workspacesContent = readFixture('inputs/workspaces.json');
const vendorisedContent = readFixture('is-object.json');
const invalidNameContent = readFixture('invalid-name.json');

describe('manager/npm/extract', () => {
  describe('.extractPackageFile()', () => {
    beforeEach(() => {
      platform.getFile.mockReturnValue(null);
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
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
    });
    it('finds a lock file', async () => {
      platform.getFile = jest.fn(fileName => {
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
      expect(res).toMatchSnapshot();
    });
    it('finds and filters .npmrc', async () => {
      platform.getFile = jest.fn(fileName => {
        if (fileName === '.npmrc') {
          return 'save-exact = true\npackage-lock = false\n';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        { global: {} }
      );
      expect(res.npmrc).toBeDefined();
    });
    it('finds and discards .npmrc', async () => {
      platform.getFile = jest.fn(fileName => {
        if (fileName === '.npmrc') {
          // eslint-disable-next-line
          return '//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}\n';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        { global: {} }
      );
      expect(res.npmrc).toBeUndefined();
    });
    it('finds lerna', async () => {
      platform.getFile = jest.fn(fileName => {
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
      expect(res).toMatchSnapshot();
    });
    it('finds "npmClient":"npm" in lerna.json', async () => {
      platform.getFile = jest.fn(fileName => {
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
      expect(res).toMatchSnapshot();
    });
    it('finds "npmClient":"yarn" in lerna.json', async () => {
      platform.getFile = jest.fn(fileName => {
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
      expect(res).toMatchSnapshot();
    });
    it('finds complex yarn workspaces', async () => {
      platform.getFile = jest.fn(fileName => {
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
      expect(res).toMatchSnapshot();
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
          yarn: 'disabled',
        },
        main: 'index.js',
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot();
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
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
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
        },
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractPackageFile(
        pJsonStr,
        'package.json',
        defaultConfig
      );
      expect(res).toMatchSnapshot();
    });
    it('extracts npm package alias', async () => {
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
      expect(res).toMatchSnapshot();
    });
  });
  describe('.postExtract()', () => {
    it('runs', async () => {
      await npmExtract.postExtract([]);
    });
  });
});
