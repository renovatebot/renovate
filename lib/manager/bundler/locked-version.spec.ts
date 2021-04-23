import { loadFixture } from '../../../test/util';
import { extractLockFileEntries } from './locked-version';

const railsGemfileLock = loadFixture(__filename, 'Gemfile.rails.lock');
const webPackerGemfileLock = loadFixture(__filename, 'Gemfile.webpacker.lock');
const mastodonGemfileLock = loadFixture(__filename, 'Gemfile.mastodon.lock');
const rubyCIGemfileLock = loadFixture(__filename, 'Gemfile.rubyci.lock');
const gitlabFossGemfileLock = loadFixture(
  __filename,
  'Gemfile.gitlab-foss.lock'
);

describe('/lib/manager/bundler/locked-version', () => {
  test('Parse Rails Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(railsGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse WebPacker Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(webPackerGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse Mastodon Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(mastodonGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse Ruby CI Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(rubyCIGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse Gitlab Foss Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(gitlabFossGemfileLock);
    expect(parsedLockEntries).toMatchSnapshot();
  });
});
