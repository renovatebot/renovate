import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { logger } from '~test/util.ts';
import { extractLockFileEntries } from './locked-version.ts';

const railsGemfileLock = Fixtures.get('Gemfile.rails.lock');
const webPackerGemfileLock = Fixtures.get('Gemfile.webpacker.lock');
const mastodonGemfileLock = Fixtures.get('Gemfile.mastodon.lock');
const rubyCIGemfileLock = Fixtures.get('Gemfile.rubyci.lock');
const gitlabFossGemfileLock = Fixtures.get('Gemfile.gitlab-foss.lock');

describe('modules/manager/bundler/locked-version', () => {
  it('Parse Rails Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(railsGemfileLock);
    expect(Object.fromEntries(parsedLockEntries)).toEqual({
      'activerecord-jdbc-adapter': '52.1',
      'activerecord-jdbcsqlite3-adapter': '52.1',
      'azure-core': '0.1.14',
      'azure-storage': '0.15.0.preview',
      listen: '3.1.5',
      nokogiri: '1.9.1',
      pg: '1.1.3',
      rake: '12.3.1',
      redcarpet: '3.2.3',
    });
  });

  it('Parse WebPacker Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(webPackerGemfileLock);
    expect(Object.fromEntries(parsedLockEntries)).toEqual({
      byebug: '11.0.1',
      'concurrent-ruby': '1.1.5',
      minitest: '5.13.0',
      rack: '2.0.8',
      'rack-proxy': '0.6.5',
      rails: '6.0.1',
      railties: '6.0.1',
      rake: '13.0.0',
    });
  });

  it('Parse Mastodon Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(mastodonGemfileLock);
    expect(Object.fromEntries(parsedLockEntries)).toEqual({
      'aws-sdk-core': '3.84.0',
      'aws-sdk-s3': '1.59.0',
      'concurrent-ruby': '1.1.5',
      devise_pam_authenticatable2: '9.2.0',
      fabrication: '2.21.0',
      'fog-core': '2.1.0',
      'pkg-config': '1.4.0',
      private_address_check: '0.5.0',
    });
  });

  it('Parse Ruby CI Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(rubyCIGemfileLock);
    expect(Object.fromEntries(parsedLockEntries)).toEqual({
      activejob: '5.2.3',
      activesupport: '5.2.3',
      foreman: '0.86.0',
      pg: '1.2.1',
      puma: '4.3.1',
      rails: '5.2.3',
      'sass-rails': '5.1.0',
      sqlite3: '1.4.2',
      sqreen: '1.17.0',
    });
  });

  it('Parse Gitlab Foss Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(gitlabFossGemfileLock);
    expect(Object.fromEntries(parsedLockEntries)).toEqual({
      RedCloth: '4.3.2',
      bootsnap: '1.4.5',
      bullet: '6.0.2',
      'elasticsearch-api': '5.0.3',
      'gitlab-puma': '4.3.1.gitlab.2',
      'graphql-docs': '1.6.0',
      liquid: '4.0.3',
      'omniauth-kerberos': '0.3.0',
      'omniauth-ultraauth': '0.0.2',
      rails: '5.2.3',
      rubyzip: '1.3.0',
    });
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
