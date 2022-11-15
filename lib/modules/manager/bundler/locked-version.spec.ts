import { Fixtures } from '../../../../test/fixtures';
import { logger } from '../../../../test/util';
import { extractLockFileEntries } from './locked-version';

const railsGemfileLock = Fixtures.get('Gemfile.rails.lock');
const webPackerGemfileLock = Fixtures.get('Gemfile.webpacker.lock');
const mastodonGemfileLock = Fixtures.get('Gemfile.mastodon.lock');
const rubyCIGemfileLock = Fixtures.get('Gemfile.rubyci.lock');
const gitlabFossGemfileLock = Fixtures.get('Gemfile.gitlab-foss.lock');

describe('modules/manager/bundler/locked-version', () => {
  test('Parse Rails Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(railsGemfileLock);
    expect(parsedLockEntries.size).toBe(185);
    expect(parsedLockEntries).toMatchSnapshot();
  });

  test('Parse WebPacker Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(webPackerGemfileLock);
    expect(parsedLockEntries.size).toBe(53);
    expect(parsedLockEntries).toMatchSnapshot();
  });

  test('Parse Mastodon Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(mastodonGemfileLock);
    expect(parsedLockEntries.size).toBe(266);
    expect(parsedLockEntries).toMatchSnapshot();
  });

  test('Parse Ruby CI Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(rubyCIGemfileLock);
    expect(parsedLockEntries.size).toBe(64);
    expect(parsedLockEntries).toMatchSnapshot();
  });

  test('Parse Gitlab Foss Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(gitlabFossGemfileLock);
    expect(parsedLockEntries.size).toBe(478);
    expect(parsedLockEntries).toMatchSnapshot();
  });

  it('returns empty map for empty string', () => {
    const parsedLockEntries = extractLockFileEntries('');
    expect(parsedLockEntries.size).toBe(0);
  });

  it('returns empty map when errors occur', () => {
    const parsedLockEntries = extractLockFileEntries(undefined as never);
    expect(parsedLockEntries.size).toBe(0);
    expect(logger.logger.warn).toHaveBeenCalledTimes(1);
  });
});
