import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/bundler/extract';
import { platform as _platform } from '../../../lib/platform';
import { isValid } from '../../../lib/versioning/ruby';

const platform: any = _platform;

const railsGemfile = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rails',
  'utf8'
);
const railsGemfileLock = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rails.lock',
  'utf8'
);

const sourceGroupGemfile = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.sourceGroup',
  'utf8'
);
const webPackerGemfile = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.webpacker',
  'utf8'
);
const webPackerGemfileLock = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.webpacker.lock',
  'utf8'
);
const mastodonGemfile = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.mastodon',
  'utf8'
);
const mastodonGemfileLock = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.mastodon.lock',
  'utf8'
);
const rubyCIGemfileLock = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rubyci.lock',
  'utf8'
);

const rubyCIGemfile = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.rubyci',
  'utf8'
);
const gitlabFossGemfileLock = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.gitlab-foss.lock',
  'utf8'
);
const gitlabFossGemfile = readFileSync(
  'test/manager/bundler/_fixtures/Gemfile.gitlab-foss',
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
      // couple of dependency of ruby rails are not present in the lock file. Filter out those before processing
      expect(
        res.deps
          .filter(dep => {
            return Object.prototype.hasOwnProperty.call(dep, 'lockedVersion');
          })
          .every(dep => {
            return (
              Object.prototype.hasOwnProperty.call(dep, 'lockedVersion') &&
              isValid(dep.lockedVersion)
            );
          })
      ).toBe(true);
      validateGems(railsGemfile, res);
    });
    it('parses sourceGroups', async () => {
      const res = await extractPackageFile(sourceGroupGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      validateGems(sourceGroupGemfile, res);
    });
    it('parse webpacker Gemfile', async () => {
      platform.getFile.mockReturnValueOnce(webPackerGemfileLock);
      const res = await extractPackageFile(webPackerGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(
        res.deps.every(dep => {
          return (
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion') &&
            isValid(dep.lockedVersion)
          );
        })
      ).toBe(true);
      validateGems(webPackerGemfile, res);
    });
    it('parse mastodon Gemfile', async () => {
      platform.getFile.mockReturnValueOnce(mastodonGemfileLock);
      const res = await extractPackageFile(mastodonGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(
        res.deps
          .filter(dep => {
            return Object.prototype.hasOwnProperty.call(dep, 'lockedVersion');
          })
          .every(dep => {
            return (
              Object.prototype.hasOwnProperty.call(dep, 'lockedVersion') &&
              isValid(dep.lockedVersion)
            );
          })
      ).toBe(true);
      validateGems(mastodonGemfile, res);
    });
    it('parse Ruby CI Gemfile', async () => {
      platform.getFile.mockReturnValueOnce(rubyCIGemfileLock);
      const res = await extractPackageFile(rubyCIGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(
        res.deps.every(dep => {
          return (
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion') &&
            isValid(dep.lockedVersion)
          );
        })
      ).toBe(true);
      validateGems(rubyCIGemfile, res);
    });
  });
  it('parse Gitlab Foss Gemfile', async () => {
    platform.getFile.mockReturnValueOnce(gitlabFossGemfileLock);
    const res = await extractPackageFile(gitlabFossGemfile, 'Gemfile');
    expect(res).toMatchSnapshot();
    expect(
      res.deps.every(dep => {
        return (
          Object.prototype.hasOwnProperty.call(dep, 'lockedVersion') &&
          isValid(dep.lockedVersion)
        );
      })
    ).toBe(true);
    validateGems(gitlabFossGemfile, res);
  });
});
