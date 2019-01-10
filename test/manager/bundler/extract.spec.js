const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/bundler/extract');

const railsGemfile = fs.readFileSync(
  'test/_fixtures/bundler/Gemfile.rails',
  'utf8'
);

const sourceGroupGemfile = fs.readFileSync(
  'test/_fixtures/bundler/Gemfile.sourceGroup',
  'utf8'
);

function validateGems(raw, parsed) {
  const gemfileGemCount = raw.match(/\n\s*gem\s+/g).length;
  const parsedGemCount = parsed.deps.length;
  expect(gemfileGemCount).toEqual(parsedGemCount);
}

describe('lib/manager/bundler/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', config)).toBeNull();
    });
    it('parses rails Gemfile', () => {
      const res = extractPackageFile(railsGemfile);
      expect(res).toMatchSnapshot();
      validateGems(railsGemfile, res);
    });
    it('parses sourceGroups', () => {
      const res = extractPackageFile(sourceGroupGemfile);
      expect(res).toMatchSnapshot();
      validateGems(sourceGroupGemfile, res);
    });
  });
});
