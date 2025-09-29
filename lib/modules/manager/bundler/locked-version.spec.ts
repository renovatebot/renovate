import { codeBlock } from 'common-tags';
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
    const gemfileLockWithPlatforms = codeBlock`
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

  describe('version extraction regex', () => {
    it('extracts simple versions from parentheses', () => {
      const gemfileLock = codeBlock`
        GEM
          remote: https://rubygems.org/
          specs:
            simple_gem (1.0.0)
            another_gem (2.3.4)
      `;

      const parsedLockEntries = extractLockFileEntries(gemfileLock);
      expect(parsedLockEntries.get('simple_gem')).toBe('1.0.0');
      expect(parsedLockEntries.get('another_gem')).toBe('2.3.4');
    });

    it('extracts complex version formats from parentheses', () => {
      const gemfileLock = codeBlock`
        GEM
          remote: https://rubygems.org/
          specs:
            gem_with_prerelease (1.0.0.beta1)
            gem_with_patch (1.2.3.4)
            gem_with_alpha (2.0.0.alpha)
      `;

      const parsedLockEntries = extractLockFileEntries(gemfileLock);
      expect(parsedLockEntries.get('gem_with_prerelease')).toBe('1.0.0.beta1');
      expect(parsedLockEntries.get('gem_with_patch')).toBe('1.2.3.4');
      expect(parsedLockEntries.get('gem_with_alpha')).toBe('2.0.0.alpha');
    });

    it('correctly extracts gem names when versions contain special characters', () => {
      const gemfileLock = codeBlock`
        GEM
          remote: https://rubygems.org/
          specs:
            gem-with-dashes (1.0.0)
            gem_with_underscores (2.0.0)
            gem.with.dots (3.0.0)
      `;

      const parsedLockEntries = extractLockFileEntries(gemfileLock);
      expect(parsedLockEntries.get('gem-with-dashes')).toBe('1.0.0');
      expect(parsedLockEntries.get('gem_with_underscores')).toBe('2.0.0');
      expect(parsedLockEntries.get('gem.with.dots')).toBe('3.0.0');
    });

    it('handles gems with platform-specific versions', () => {
      const gemfileLock = codeBlock`
        GEM
          remote: https://rubygems.org/
          specs:
            platform_gem (1.5.0-x86_64-linux)
            another_platform_gem (2.1.0-arm64-darwin)

        PLATFORMS
          x86_64-linux
          arm64-darwin
      `;

      const parsedLockEntries = extractLockFileEntries(gemfileLock);
      expect(parsedLockEntries.get('platform_gem')).toBe('1.5.0');
      expect(parsedLockEntries.get('another_platform_gem')).toBe('2.1.0');
    });
  });
});
