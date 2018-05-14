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
  });
  describe('.postExtract()', () => {
    it('runs', async () => {
      await npmExtract.postExtract([]);
    });
  });
});
