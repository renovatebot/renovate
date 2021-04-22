import { readFileSync } from 'fs';
import upath from 'upath';
import { getName } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import * as _fs from '../../../util/fs';
import * as npmExtract from '.';

const fs: any = _fs;

// TODO: fix types
const defaultConfig = getConfig();

function readFixture(fixture: string) {
  return readFileSync(
    upath.resolve(__dirname, `../__fixtures__/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('inputs/01.json');
const workspacesContent = readFixture('inputs/workspaces.json');
const workspacesSimpleContent = readFixture('inputs/workspaces-simple.json');
const vendorisedContent = readFixture('is-object.json');
const invalidNameContent = readFixture('invalid-name.json');

describe(getName(__filename), () => {
  describe('.extractPackageFile()', () => {
    beforeEach(() => {
      fs.readLocalFile = jest.fn(() => null);
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
      expect(res).toMatchSnapshot();
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
    it('ignores .npmrc when config.npmrc is defined', async () => {
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
    it('finds and filters .npmrc with variables', async () => {
      fs.readLocalFile = jest.fn((fileName) => {
        if (fileName === '.npmrc') {
          // eslint-disable-next-line
          return 'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}\n';
        }
        return null;
      });
      const res = await npmExtract.extractPackageFile(
        input01Content,
        'package.json',
        {}
      );
      expect(res.npmrc).toEqual('registry=https://registry.npmjs.org\n');
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
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
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
      await expect(npmExtract.postExtract([], false)).resolves.not.toThrow();
    });
  });
});
