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
    it('skips sourceforge dependency', () => {
      expect(extractPackageFile(aalib)).not.toBeNull();
      expect(extractPackageFile(aalib).deps[0].skipReason).toBe(
        'unsupported-url'
      );
      expect(extractPackageFile(aalib)).toMatchSnapshot();
    });
    it('skips sourceforge dependency', () => {
      expect(extractPackageFile(aap)).not.toBeNull();
      expect(extractPackageFile(aap).deps[0].skipReason).toBe(
        'unsupported-url'
      );
      expect(extractPackageFile(aap)).toMatchSnapshot();
    });
    it('skips github dependency with wrong format', () => {
      expect(extractPackageFile(acmetool)).not.toBeNull();
      expect(extractPackageFile(acmetool).deps[0].skipReason).toBe(
        'unsupported-url'
      );
      expect(extractPackageFile(acmetool)).toMatchSnapshot();
    });
    it('extracts "releases" github dependency', () => {
      expect(extractPackageFile(aide)).not.toBeNull();
      expect(extractPackageFile(aide).deps[0].skipReason).toBeUndefined();
      expect(extractPackageFile(aide)).toMatchSnapshot();
    });
    it('extracts "archive" github dependency', () => {
      expect(extractPackageFile(ibazel)).not.toBeNull();
      expect(extractPackageFile(ibazel).deps[0].skipReason).toBeUndefined();
      expect(extractPackageFile(ibazel)).toMatchSnapshot();
    });
  });
});
