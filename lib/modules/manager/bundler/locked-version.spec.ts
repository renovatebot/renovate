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
    const lockEntries = Object.fromEntries(parsedLockEntries);
    expect(Object.keys(lockEntries)).toHaveLength(185);
    // first entry, its `-java` platform suffix stripped; `bcrypt` is listed
    // once per platform and is kept only once
    expect(lockEntries).toMatchObject({
      'activerecord-jdbc-adapter': '52.1',
      bcrypt: '3.1.12',
      'azure-storage': '0.15.0.preview',
      'http_parser.rb': '0.6.0',
      'mime-types-data': '3.2018.0812',
      parser: '2.5.3.0',
      xpath: '3.2.0',
    });
  });

  it('Parse WebPacker Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(webPackerGemfileLock);
    expect(Object.fromEntries(parsedLockEntries)).toEqual({
      actioncable: '6.0.1',
      actionmailbox: '6.0.1',
      actionmailer: '6.0.1',
      actionpack: '6.0.1',
      actiontext: '6.0.1',
      actionview: '6.0.1',
      activejob: '6.0.1',
      activemodel: '6.0.1',
      activerecord: '6.0.1',
      activestorage: '6.0.1',
      activesupport: '6.0.1',
      ast: '2.4.0',
      builder: '3.2.3',
      byebug: '11.0.1',
      'concurrent-ruby': '1.1.5',
      crass: '1.0.5',
      erubi: '1.9.0',
      globalid: '0.4.2',
      i18n: '1.7.0',
      jaro_winkler: '1.5.4',
      loofah: '2.3.1',
      mail: '2.7.1',
      marcel: '0.3.3',
      method_source: '0.9.2',
      mimemagic: '0.3.3',
      mini_mime: '1.0.2',
      mini_portile2: '2.4.0',
      minitest: '5.13.0',
      nio4r: '2.5.2',
      nokogiri: '1.10.5',
      parallel: '1.18.0',
      parser: '2.6.5.0',
      rack: '2.0.8',
      'rack-proxy': '0.6.5',
      'rack-test': '1.1.0',
      rails: '6.0.1',
      'rails-dom-testing': '2.0.3',
      'rails-html-sanitizer': '1.3.0',
      railties: '6.0.1',
      rainbow: '3.0.0',
      rake: '13.0.0',
      rubocop: '0.68.1',
      'rubocop-performance': '1.3.0',
      'ruby-progressbar': '1.10.1',
      sprockets: '4.0.0',
      'sprockets-rails': '3.2.1',
      thor: '0.20.3',
      thread_safe: '0.3.6',
      tzinfo: '1.2.5',
      'unicode-display_width': '1.5.0',
      'websocket-driver': '0.7.1',
      'websocket-extensions': '0.1.4',
      zeitwerk: '2.2.1',
    });
  });

  it('Parse Mastodon Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(mastodonGemfileLock);
    const lockEntries = Object.fromEntries(parsedLockEntries);
    expect(Object.keys(lockEntries)).toHaveLength(266);
    // first and last entries, plus two-, three- and four-segment versions
    expect(lockEntries).toMatchObject({
      actioncable: '5.2.4.1',
      active_record_query_trace: '1.7',
      'aws-sdk-s3': '1.59.0',
      parser: '2.6.5.0',
      unf_ext: '0.0.7.6',
      xpath: '3.2.0',
    });
  });

  it('Parse Ruby CI Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(rubyCIGemfileLock);
    expect(Object.fromEntries(parsedLockEntries)).toEqual({
      actioncable: '5.2.3',
      actionmailer: '5.2.3',
      actionpack: '5.2.3',
      actionview: '5.2.3',
      activejob: '5.2.3',
      activemodel: '5.2.3',
      activerecord: '5.2.3',
      activestorage: '5.2.3',
      activesupport: '5.2.3',
      airbrake: '9.5.5',
      'airbrake-ruby': '4.8.0',
      arel: '9.0.0',
      bootsnap: '1.4.5',
      builder: '3.2.3',
      'concurrent-ruby': '1.1.5',
      crass: '1.0.5',
      erubi: '1.9.0',
      execjs: '2.7.0',
      ffi: '1.11.3',
      foreman: '0.86.0',
      globalid: '0.4.2',
      i18n: '1.7.0',
      'jquery-rails': '4.3.5',
      listen: '3.2.1',
      loofah: '2.3.1',
      mail: '2.7.1',
      marcel: '0.3.3',
      method_source: '0.9.2',
      mimemagic: '0.3.3',
      mini_mime: '1.0.2',
      mini_portile2: '2.4.0',
      minitest: '5.12.2',
      msgpack: '1.3.1',
      newrelic_rpm: '6.8.0.360',
      nio4r: '2.5.2',
      nokogiri: '1.10.5',
      pg: '1.2.1',
      puma: '4.3.1',
      rack: '2.0.8',
      'rack-test': '1.1.0',
      rails: '5.2.3',
      'rails-dom-testing': '2.0.3',
      'rails-html-sanitizer': '1.3.0',
      railties: '5.2.3',
      rake: '13.0.0',
      'rb-fsevent': '0.10.3',
      'rb-inotify': '0.10.0',
      rbtree3: '0.5.0',
      sass: '3.7.4',
      'sass-listen': '4.0.0',
      'sass-rails': '5.1.0',
      'sass-rails-bootstrap': '2.2.2.3',
      sprockets: '3.7.2',
      'sprockets-rails': '3.2.1',
      sq_mini_racer: '0.2.5.0.1.beta2',
      sqlite3: '1.4.2',
      sqreen: '1.17.0',
      thor: '0.20.3',
      thread_safe: '0.3.6',
      tilt: '2.0.10',
      tzinfo: '1.2.5',
      uglifier: '4.2.0',
      'websocket-driver': '0.7.1',
      'websocket-extensions': '0.1.4',
    });
  });

  it('Parse Gitlab Foss Gem Lock File', () => {
    const parsedLockEntries = extractLockFileEntries(gitlabFossGemfileLock);
    const lockEntries = Object.fromEntries(parsedLockEntries);
    expect(Object.keys(lockEntries)).toHaveLength(478);
    // first and last entries, plus prerelease and vendor-suffixed versions
    expect(lockEntries).toMatchObject({
      RedCloth: '4.3.2',
      apollo_upload_server: '2.0.0.beta.3',
      'gitlab-puma': '4.3.1.gitlab.2',
      'http_parser.rb': '0.6.0',
      'pyu-ruby-sasl': '0.0.3.3',
      'rspec-rails': '4.0.0.beta3',
      xpath: '3.2.0',
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
