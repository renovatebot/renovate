const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/homebrew/extract');

const aalib = fs.readFileSync(
  'test/manager/homebrew/_fixtures/aalib.rb',
  'utf8'
);
const aap = fs.readFileSync('test/manager/homebrew/_fixtures/aap.rb', 'utf8');
const acmetool = fs.readFileSync(
  'test/manager/homebrew/_fixtures/acmetool.rb',
  'utf8'
);
const aide = fs.readFileSync('test/manager/homebrew/_fixtures/aide.rb', 'utf8');
const ibazel = fs.readFileSync(
  'test/manager/homebrew/_fixtures/ibazel.rb',
  'utf8'
);

describe('lib/manager/homebrew/extract', () => {
  describe('extractPackageFile()', () => {
    it('skips non github dependencies', () => {
      expect(extractPackageFile(aalib)).toBeNull();
    });
    it('skips non github dependencies', () => {
      expect(extractPackageFile(aap)).toBeNull();
    });
    it('skips github dependency with wrong format', () => {
      expect(extractPackageFile(acmetool)).toBeNull();
    });
    it('extracts github dependency', () => {
      expect(extractPackageFile(aide)).not.toBeNull();
      expect(extractPackageFile(aide)).toMatchSnapshot();
    });
    it('extracts github dependency', () => {
      expect(extractPackageFile(ibazel)).not.toBeNull();
      expect(extractPackageFile(ibazel)).toMatchSnapshot();
    });
  });
});
