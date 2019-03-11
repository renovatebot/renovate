const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/bundler/extract');

const railsGemfile = fs.readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rails',
  'utf8'
);
const railsGemfileLock = fs.readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rails.lock',
  'utf8'
);

const sourceGroupGemfile = fs.readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.sourceGroup',
  'utf8'
);

function validateGems(raw, parsed) {
  const gemfileGemCount = raw.match(/\n\s*gem\s+/g).length;
  const parsedGemCount = parsed.deps.length;
  expect(gemfileGemCount).toEqual(parsedGemCount);
}

describe('lib/manager/bundler/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(await extractPackageFile('nothing here', 'Gemfile')).toBeNull();
    });
    it('parses rails Gemfile', async () => {
      platform.getFile.mockReturnValueOnce(railsGemfileLock);
      const res = await extractPackageFile(railsGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      validateGems(railsGemfile, res);
    });
    it('parses sourceGroups', async () => {
      const res = await extractPackageFile(sourceGroupGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      validateGems(sourceGroupGemfile, res);
    });
  });
});
