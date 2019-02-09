const fs = require('fs');
const { extractAllPackageFiles } = require('../../../lib/manager/bundler');

function getFilesContent(fixtureName) {
  const gemfilePath = `test/_fixtures/bundler/${fixtureName}`;
  const lockfilePath = `test/_fixtures/bundler/${fixtureName}.lock`;

  return [gemfilePath, lockfilePath].map(path => fs.readFileSync(path, 'utf8'));
}

function validateGems(content, result) {
  const numberOfResultGems = result.deps.length;
  const numberOfFileGems = content.match(/\n\s*gem\s+/g).length;

  expect(numberOfResultGems).toEqual(numberOfFileGems);
}

describe('lib/manager/bundler/extract', () => {
  describe('extractAllPackageFiles()', () => {
    it('returns null for empty', async () => {
      platform.getFile.mockReturnValue(null);
      expect(await extractAllPackageFiles({}, ['Gemfile.empty'])).toHaveLength(
        0
      );
    });

    it('parses rails Gemfile', async () => {
      const file = 'Gemfile.rails';
      const [gemfileContent, lockfileContent] = getFilesContent(file);

      platform.getFile.mockReturnValueOnce(gemfileContent);
      platform.getFile.mockReturnValueOnce(lockfileContent);

      const [result, ...rest] = await extractAllPackageFiles({}, [file]);

      expect(rest).toHaveLength(0);
      expect(result).toMatchSnapshot();

      validateGems(gemfileContent, result);
    });

    it('parses sourceGroup Gemfile', async () => {
      const file = 'Gemfile.sourceGroup';
      const [gemfileContent, lockfileContent] = getFilesContent(file);

      platform.getFile.mockReturnValueOnce(gemfileContent);
      platform.getFile.mockReturnValueOnce(lockfileContent);

      const [result, ...rest] = await extractAllPackageFiles({}, [file]);

      expect(rest).toHaveLength(0);
      expect(result).toMatchSnapshot();

      validateGems(gemfileContent, result);
    });

    it('parses complex Gemfile', async () => {
      const file = 'Gemfile.complex';
      const [gemfileContent, lockfileContent] = getFilesContent(file);

      platform.getFile.mockReturnValueOnce(gemfileContent);
      platform.getFile.mockReturnValueOnce(lockfileContent);

      const [result, ...rest] = await extractAllPackageFiles({}, [file]);

      expect(rest).toHaveLength(0);
      expect(result).toMatchSnapshot();

      validateGems(gemfileContent, result);
    });
  });
});
