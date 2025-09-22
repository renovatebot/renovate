import { extractLockFileEntries } from './locked-version';
import { Fixtures } from '~test/fixtures';
import { logger } from '~test/util';

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

  it('strips platform suffixes from dependencies', () => {
    const gemfileLockWithPlatforms = `
GEM
  remote: https://rubygems.org/
  specs:
    sqlite3 (2.7.4-aarch64-linux-gnu)
    sqlite3 (2.7.4-arm64-darwin)
    sqlite3 (2.7.4-x86_64-darwin)
    nokogiri (1.18.10-aarch64-linux-gnu)
      racc (~> 1.4)
    nokogiri (1.18.10-x86_64-darwin)
      racc (~> 1.4)
    regular_gem (1.0.0)

PLATFORMS
  aarch64-linux-gnu
  arm64-darwin
  x86_64-darwin

DEPENDENCIES
  sqlite3 (>= 2.1)
`;

    const parsedLockEntries = extractLockFileEntries(gemfileLockWithPlatforms);
    expect(parsedLockEntries.get('sqlite3')).toBe('2.7.4');
    expect(parsedLockEntries.get('nokogiri')).toBe('1.18.10');
    expect(parsedLockEntries.get('regular_gem')).toBe('1.0.0');
  });
});
