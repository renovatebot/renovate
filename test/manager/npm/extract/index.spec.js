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
const workspacesContent = readFixture('inputs/workspaces.json');

describe('manager/npm/extract', () => {
  describe('.extractDependencies()', () => {
    beforeEach(() => {
      platform.getFile.mockReturnValue(null);
    });
    it('returns null if cannot parse', async () => {
      const res = await npmExtract.extractDependencies(
        'not json',
        'package.json',
        {}
      );
      expect(res).toBe(null);
    });
    it('throws error if non-root renovate config', async () => {
      let e;
      try {
        await npmExtract.extractDependencies(
          '{ "renovate": {} }',
          'backend/package.json',
          {}
        );
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
    it('returns null if no deps', async () => {
      const res = await npmExtract.extractDependencies(
        '{ "renovate": {} }',
        'package.json',
        {}
      );
      expect(res).toBe(null);
    });
    it('handles invalid', async () => {
      const res = await npmExtract.extractDependencies(
        '{"dependencies": true, "devDependencies": []}',
        'package.json',
        {}
      );
      expect(res).toBe(null);
    });
    it('returns an array of dependencies', async () => {
      const res = await npmExtract.extractDependencies(
        input01Content,
        'package.json',
        {}
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
        'package.json',
        {}
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
      const res = await npmExtract.extractDependencies(
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
      const res = await npmExtract.extractDependencies(
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
      const res = await npmExtract.extractDependencies(
        input01Content,
        'package.json',
        {}
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
      const res = await npmExtract.extractDependencies(
        workspacesContent,
        'package.json',
        {}
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
      };
      const pJsonStr = JSON.stringify(pJson);
      const res = await npmExtract.extractDependencies(
        pJsonStr,
        'package.json',
        {}
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
