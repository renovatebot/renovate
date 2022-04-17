import { fs, loadFixture } from '../../../../test/util';
import { isValid } from '../../versioning/ruby';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

const railsGemfile = loadFixture('Gemfile.rails');
const railsGemfileLock = loadFixture('Gemfile.rails.lock');

const sourceGroupGemfile = loadFixture('Gemfile.sourceGroup');
const webPackerGemfile = loadFixture('Gemfile.webpacker');
const webPackerGemfileLock = loadFixture('Gemfile.webpacker.lock');
const mastodonGemfile = loadFixture('Gemfile.mastodon');
const mastodonGemfileLock = loadFixture('Gemfile.mastodon.lock');
const rubyCIGemfileLock = loadFixture('Gemfile.rubyci.lock');

const rubyCIGemfile = loadFixture('Gemfile.rubyci');
const gitlabFossGemfileLock = loadFixture('Gemfile.gitlab-foss.lock');
const gitlabFossGemfile = loadFixture('Gemfile.gitlab-foss');
const sourceBlockGemfile = loadFixture('Gemfile.sourceBlock');
const sourceBlockWithNewLinesGemfileLock = loadFixture(
  'Gemfile.sourceBlockWithNewLines.lock'
);
const sourceBlockWithNewLinesGemfile = loadFixture(
  'Gemfile.sourceBlockWithNewLines'
);

describe('modules/manager/bundler/extract', () => {
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
      ).toBeTrue();
      expect(res.deps).toHaveLength(68);
    });

    it('parses sourceGroups', async () => {
      const res = await extractPackageFile(sourceGroupGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(7);
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
      ).toBeTrue();
      expect(res.deps).toHaveLength(5);
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
      ).toBeTrue();
      expect(res.deps).toHaveLength(125);
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
      ).toBeTrue();
      expect(res.deps).toHaveLength(14);
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
    ).toBeTrue();
    expect(res.deps).toHaveLength(252);
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
    expect(res.deps).toHaveLength(2);
  });
});
