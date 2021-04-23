import { fs, getName, loadFixture } from '../../../test/util';
import { isValid } from '../../versioning/ruby';
import { extractPackageFile } from './extract';

jest.mock('../../util/fs');

const railsGemfile = loadFixture(__filename, 'Gemfile.rails');
const railsGemfileLock = loadFixture(__filename, 'Gemfile.rails.lock');

const sourceGroupGemfile = loadFixture(__filename, 'Gemfile.sourceGroup');
const webPackerGemfile = loadFixture(__filename, 'Gemfile.webpacker');
const webPackerGemfileLock = loadFixture(__filename, 'Gemfile.webpacker.lock');
const mastodonGemfile = loadFixture(__filename, 'Gemfile.mastodon');
const mastodonGemfileLock = loadFixture(__filename, 'Gemfile.mastodon.lock');
const rubyCIGemfileLock = loadFixture(__filename, 'Gemfile.rubyci.lock');

const rubyCIGemfile = loadFixture(__filename, 'Gemfile.rubyci');
const gitlabFossGemfileLock = loadFixture(
  __filename,
  'Gemfile.gitlab-foss.lock'
);
const gitlabFossGemfile = loadFixture(__filename, 'Gemfile.gitlab-foss');
const sourceBlockGemfile = loadFixture(__filename, 'Gemfile.sourceBlock');
const sourceBlockWithNewLinesGemfileLock = loadFixture(
  __filename,
  'Gemfile.sourceBlockWithNewLines.lock'
);
const sourceBlockWithNewLinesGemfile = loadFixture(
  __filename,
  'Gemfile.sourceBlockWithNewLines'
);

function validateGems(raw, parsed) {
  const gemfileGemCount = raw.match(/\n\s*gem\s+/g).length;
  const parsedGemCount = parsed.deps.length;
  expect(gemfileGemCount).toEqual(parsedGemCount);
}

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(await extractPackageFile('nothing here', 'Gemfile')).toBeNull();
    });
    it('parses rails Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(railsGemfileLock);
      const res = await extractPackageFile(railsGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      // couple of dependency of ruby rails are not present in the lock file. Filter out those before processing
      expect(
        res.deps
          .filter((dep) =>
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion')
          )
          .every(
            (dep) =>
              Object.prototype.hasOwnProperty.call(dep, 'lockedVersion') &&
              isValid(dep.lockedVersion)
          )
      ).toBe(true);
      validateGems(railsGemfile, res);
    });
    it('parses sourceGroups', async () => {
      const res = await extractPackageFile(sourceGroupGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      validateGems(sourceGroupGemfile, res);
    });
    it('parse webpacker Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(webPackerGemfileLock);
      const res = await extractPackageFile(webPackerGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(
        res.deps.every(
          (dep) =>
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion') &&
            isValid(dep.lockedVersion)
        )
      ).toBe(true);
      validateGems(webPackerGemfile, res);
    });
    it('parse mastodon Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(mastodonGemfileLock);
      const res = await extractPackageFile(mastodonGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(
        res.deps
          .filter((dep) =>
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion')
          )
          .every(
            (dep) =>
              Object.prototype.hasOwnProperty.call(dep, 'lockedVersion') &&
              isValid(dep.lockedVersion)
          )
      ).toBe(true);
      validateGems(mastodonGemfile, res);
    });
    it('parse Ruby CI Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(rubyCIGemfileLock);
      const res = await extractPackageFile(rubyCIGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(
        res.deps.every(
          (dep) =>
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion') &&
            isValid(dep.lockedVersion)
        )
      ).toBe(true);
      validateGems(rubyCIGemfile, res);
    });
  });
  it('parse Gitlab Foss Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(gitlabFossGemfileLock);
    const res = await extractPackageFile(gitlabFossGemfile, 'Gemfile');
    expect(res).toMatchSnapshot();
    expect(
      res.deps.every(
        (dep) =>
          Object.prototype.hasOwnProperty.call(dep, 'lockedVersion') &&
          isValid(dep.lockedVersion)
      )
    ).toBe(true);
    validateGems(gitlabFossGemfile, res);
  });

  it('parse source blocks in Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(sourceBlockGemfile);
    const res = await extractPackageFile(sourceBlockGemfile, 'Gemfile');
    expect(res).toMatchSnapshot();
  });
  it('parse source blocks with spaces in Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(sourceBlockWithNewLinesGemfileLock);
    const res = await extractPackageFile(
      sourceBlockWithNewLinesGemfile,
      'Gemfile'
    );
    expect(res).toMatchSnapshot();
    validateGems(sourceBlockWithNewLinesGemfile, res);
  });
});
