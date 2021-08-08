import { loadFixture } from '../../../test/util';
import { extractLockFileEntries } from './locked-version';

const railsGemfileLock = loadFixture('Gemfile.rails.lock');
const webPackerGemfileLock = loadFixture('Gemfile.webpacker.lock');
const mastodonGemfileLock = loadFixture('Gemfile.mastodon.lock');
const rubyCIGemfileLock = loadFixture('Gemfile.rubyci.lock');
const gitlabFossGemfileLock = loadFixture('Gemfile.gitlab-foss.lock');

describe('/lib/manager/bundler/locked-version', () => {
  test('Parse Rails Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(railsGemfileLock);
    // FIXME: explicit assert condition
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse WebPacker Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(webPackerGemfileLock);
    // FIXME: explicit assert condition
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse Mastodon Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(mastodonGemfileLock);
    // FIXME: explicit assert condition
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse Ruby CI Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(rubyCIGemfileLock);
    // FIXME: explicit assert condition
    expect(parsedLockEntries).toMatchSnapshot();
  });
  test('Parse Gitlab Foss Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(gitlabFossGemfileLock);
    // FIXME: explicit assert condition
    expect(parsedLockEntries).toMatchSnapshot();
  });
});
