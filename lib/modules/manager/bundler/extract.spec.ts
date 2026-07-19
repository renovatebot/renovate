import { isString } from '@sindresorhus/is';
import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { fs } from '~test/util.ts';
import { isValid } from '../../versioning/ruby/index.ts';
import { extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const railsGemfile = Fixtures.get('Gemfile.rails');
const railsGemfileLock = Fixtures.get('Gemfile.rails.lock');

const sourceGroupGemfile = Fixtures.get('Gemfile.sourceGroup');
const webPackerGemfile = Fixtures.get('Gemfile.webpacker');
const webPackerGemfileLock = Fixtures.get('Gemfile.webpacker.lock');
const mastodonGemfile = Fixtures.get('Gemfile.mastodon');
const mastodonGemfileLock = Fixtures.get('Gemfile.mastodon.lock');
const rubyCIGemfileLock = Fixtures.get('Gemfile.rubyci.lock');

const rubyCIGemfile = Fixtures.get('Gemfile.rubyci');
const gitlabFossGemfileLock = Fixtures.get('Gemfile.gitlab-foss.lock');
const gitlabFossGemfile = Fixtures.get('Gemfile.gitlab-foss');
const sourceBlockGemfile = Fixtures.get('Gemfile.sourceBlock');
const sourceBlockWithNewLinesGemfileLock = Fixtures.get(
  'Gemfile.sourceBlockWithNewLines.lock',
);
const sourceBlockWithNewLinesGemfile = Fixtures.get(
  'Gemfile.sourceBlockWithNewLines',
);
const sourceBlockWithGroupsGemfile = Fixtures.get(
  'Gemfile.sourceBlockWithGroups',
);

describe('modules/manager/bundler/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(await extractPackageFile('nothing here', 'Gemfile')).toBeNull();
    });

    it('parses rails Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(railsGemfileLock);
      const res = await extractPackageFile(railsGemfile, 'Gemfile');
      expect(res?.deps).toMatchObject([
        {
          depName: 'rake',
          currentValue: '">= 11.1"',
          lockedVersion: '12.3.1',
        },
        {
          depName: 'capybara',
          currentValue: '">= 2.15"',
          lockedVersion: '3.10.1',
        },
        {
          depName: 'rack-cache',
          currentValue: '"~> 1.2"',
          lockedVersion: '1.8.0',
        },
        {
          depName: 'sass-rails',
          lockedVersion: '5.0.7',
        },
        {
          depName: 'turbolinks',
          currentValue: '"~> 5"',
          lockedVersion: '5.2.0',
        },
        {
          depName: 'webpacker',
          datasource: 'git-refs',
          packageName: 'https://github.com/rails/webpacker',
        },
        {
          depName: 'bcrypt',
          currentValue: '"~> 3.1.11"',
          lockedVersion: '3.1.12',
        },
        {
          depName: 'uglifier',
          currentValue: '">= 1.3.0"',
          lockedVersion: '4.1.19',
        },
        {
          depName: 'json',
          currentValue: '">= 2.0.0"',
          lockedVersion: '2.1.0',
        },
        {
          depName: 'rubocop',
          currentValue: '">= 0.47"',
          lockedVersion: '0.61.1',
        },
        {
          depName: 'sdoc',
          currentValue: '"~> 1.0"',
          lockedVersion: '1.0.0',
          depTypes: ['doc'],
        },
        {
          depName: 'redcarpet',
          currentValue: '"~> 3.2.3"',
          lockedVersion: '3.2.3',
          depTypes: ['doc'],
        },
        {
          depName: 'w3c_validators',
          lockedVersion: '1.3.4',
          depTypes: ['doc'],
        },
        {
          depName: 'kindlerb',
          currentValue: '"~> 1.2.0"',
          lockedVersion: '1.2.0',
          depTypes: ['doc'],
        },
        {
          depName: 'dalli',
          lockedVersion: '2.7.9',
        },
        {
          depName: 'listen',
          currentValue: '">= 3.0.5", "< 3.2"',
          lockedVersion: '3.1.5',
        },
        {
          depName: 'libxml-ruby',
          lockedVersion: '3.1.0',
        },
        {
          depName: 'connection_pool',
          lockedVersion: '2.2.2',
        },
        {
          depName: 'bootsnap',
          currentValue: '">= 1.1.0"',
          lockedVersion: '1.3.2',
        },
        {
          depName: 'resque',
          lockedVersion: '1.27.4',
          depTypes: ['job'],
        },
        {
          depName: 'resque-scheduler',
          lockedVersion: '4.3.1',
          depTypes: ['job'],
        },
        {
          depName: 'sidekiq',
          lockedVersion: '5.2.3',
          depTypes: ['job'],
        },
        {
          depName: 'sucker_punch',
          lockedVersion: '2.1.1',
          depTypes: ['job'],
        },
        {
          depName: 'delayed_job',
          lockedVersion: '4.1.5',
          depTypes: ['job'],
        },
        {
          depName: 'queue_classic',
          currentValue: 'update-pg',
          depTypes: ['job'],
          datasource: 'git-refs',
          packageName: 'https://github.com/rafaelfranca/queue_classic',
        },
        {
          depName: 'sneakers',
          lockedVersion: '2.7.0',
          depTypes: ['job'],
        },
        {
          depName: 'que',
          lockedVersion: '0.14.3',
          depTypes: ['job'],
        },
        {
          depName: 'backburner',
          lockedVersion: '1.5.0',
          depTypes: ['job'],
        },
        {
          depName: 'delayed_job_active_record',
          lockedVersion: '4.1.3',
          depTypes: ['job'],
        },
        {
          depName: 'sequel',
          lockedVersion: '5.14.0',
          depTypes: ['job'],
        },
        {
          depName: 'puma',
          lockedVersion: '3.12.0',
          depTypes: ['cable'],
        },
        {
          depName: 'hiredis',
          lockedVersion: '0.6.3',
          depTypes: ['cable'],
        },
        {
          depName: 'redis',
          currentValue: '"~> 4.0"',
          lockedVersion: '4.0.3',
          depTypes: ['cable'],
        },
        {
          depName: 'redis-namespace',
          lockedVersion: '1.6.0',
          depTypes: ['cable'],
        },
        {
          depName: 'websocket-client-simple',
          currentValue: 'close-race',
          depTypes: ['cable'],
          datasource: 'git-refs',
          packageName: 'https://github.com/matthewd/websocket-client-simple',
        },
        {
          depName: 'blade',
          lockedVersion: '0.7.1',
          depTypes: ['cable'],
        },
        {
          depName: 'blade-sauce_labs_plugin',
          lockedVersion: '0.7.3',
          depTypes: ['cable'],
        },
        {
          depName: 'sprockets-export',
          lockedVersion: '1.0.0',
          depTypes: ['cable'],
        },
        {
          depName: 'aws-sdk-s3',
          lockedVersion: '1.23.1',
          depTypes: ['storage'],
        },
        {
          depName: 'google-cloud-storage',
          currentValue: '"~> 1.11"',
          lockedVersion: '1.15.0',
          depTypes: ['storage'],
        },
        {
          depName: 'azure-storage',
          lockedVersion: '0.15.0.preview',
          depTypes: ['storage'],
        },
        {
          depName: 'image_processing',
          currentValue: '"~> 1.2"',
          lockedVersion: '1.7.1',
          depTypes: ['storage'],
        },
        {
          depName: 'aws-sdk-sns',
          lockedVersion: '1.8.1',
        },
        {
          depName: 'webmock',
          lockedVersion: '3.4.2',
        },
        {
          depName: 'qunit-selenium',
          lockedVersion: '0.0.4',
          depTypes: ['ujs'],
        },
        {
          depName: 'chromedriver-helper',
          lockedVersion: '2.1.0',
          depTypes: ['ujs'],
        },
        {
          depName: 'minitest-bisect',
          lockedVersion: '1.4.0',
          depTypes: ['test'],
        },
        {
          depName: 'minitest-retry',
          lockedVersion: '0.1.9',
          depTypes: ['test'],
        },
        {
          depName: 'stackprof',
          lockedVersion: '0.2.12',
          depTypes: ['test'],
        },
        {
          depName: 'byebug',
          lockedVersion: '10.0.2',
          depTypes: ['test'],
        },
        {
          depName: 'benchmark-ips',
          lockedVersion: '2.7.2',
          depTypes: ['test'],
        },
        {
          depName: 'nokogiri',
          currentValue: '">= 1.8.1"',
          lockedVersion: '1.9.1',
        },
        {
          depName: 'racc',
          currentValue: '">=1.4.6"',
          lockedVersion: '1.4.14',
        },
        {
          depName: 'sqlite3',
          currentValue: '"~> 1.3.6"',
          lockedVersion: '1.3.13',
        },
        {
          depName: 'pg',
          currentValue: '">= 0.18.0"',
          lockedVersion: '1.1.3',
          depTypes: ['db'],
        },
        {
          depName: 'mysql2',
          currentValue: '">= 0.4.10"',
          lockedVersion: '0.5.2',
          depTypes: ['db'],
        },
        {
          depName: 'activerecord-jdbcsqlite3-adapter',
          currentValue: 'master',
          lockedVersion: '52.1',
          datasource: 'git-refs',
          packageName: 'https://github.com/jruby/activerecord-jdbc-adapter',
        },
        {
          depName: 'activerecord-jdbcmysql-adapter',
          currentValue: 'master',
          lockedVersion: '52.1',
          depTypes: ['db'],
          datasource: 'git-refs',
          packageName: 'https://github.com/jruby/activerecord-jdbc-adapter',
        },
        {
          depName: 'activerecord-jdbcpostgresql-adapter',
          currentValue: 'master',
          lockedVersion: '52.1',
          depTypes: ['db'],
          datasource: 'git-refs',
          packageName: 'https://github.com/jruby/activerecord-jdbc-adapter',
        },
        {
          depName: 'activerecord-jdbcsqlite3-adapter',
          currentValue: '">= 1.3.0"',
          lockedVersion: '52.1',
        },
        {
          depName: 'activerecord-jdbcmysql-adapter',
          currentValue: '">= 1.3.0"',
          lockedVersion: '52.1',
          depTypes: ['db'],
        },
        {
          depName: 'activerecord-jdbcpostgresql-adapter',
          currentValue: '">= 1.3.0"',
          lockedVersion: '52.1',
          depTypes: ['db'],
        },
        {
          depName: 'psych',
          currentValue: '"~> 3.0"',
          lockedVersion: '3.0.3',
        },
        {
          depName: 'ruby-oci8',
          currentValue: '"~> 2.2"',
        },
        {
          depName: 'activerecord-oracle_enhanced-adapter',
          currentValue: 'master',
          datasource: 'git-refs',
          packageName: 'https://github.com/rsim/oracle-enhanced',
        },
        {
          depName: 'ibm_db',
        },
        {
          depName: 'tzinfo-data',
          lockedVersion: '1.2018.7',
        },
        {
          depName: 'wdm',
          currentValue: '">= 0.1.0"',
          lockedVersion: '0.1.1',
        },
      ]);
      // couple of dependency of ruby rails are not present in the lock file. Filter out those before processing
      expect(
        res?.deps
          .filter((dep) =>
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion'),
          )
          .every(
            (dep) => isString(dep.lockedVersion) && isValid(dep.lockedVersion),
          ),
      ).toBeTrue();
      expect(res?.deps).toHaveLength(68);
    });

    it('parses sourceGroups', async () => {
      const res = await extractPackageFile(sourceGroupGemfile, 'Gemfile');
      expect(res).toMatchObject({
        registryUrls: ['https://rubygems.org'],
        deps: [
          {
            depName: 'ruby',
            currentValue: '~> 1.5.3',
            datasource: 'ruby-version',
          },
          {
            depName: 'some_internal_gem',
            registryUrls: ['https://gems.example.com'],
          },
          {
            depName: 'another_internal_gem',
            registryUrls: ['https://gems.example.com'],
          },
          { depName: 'ruby-debug', currentValue: '"latest"' },
          { depName: 'sqlite3' },
          { depName: 'wirble', depTypes: ['development', 'optional => true'] },
          { depName: 'faker', depTypes: ['development', 'optional => true'] },
        ],
      });
      expect(res?.deps).toHaveLength(7);
    });

    it('parse webpacker Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(webPackerGemfileLock);
      const res = await extractPackageFile(webPackerGemfile, 'Gemfile');
      expect(res?.deps).toMatchObject([
        {
          depName: 'rails',
          lockedVersion: '6.0.1',
        },
        {
          depName: 'rake',
          currentValue: '">= 11.1"',
          lockedVersion: '13.0.0',
        },
        {
          depName: 'rack-proxy',
          lockedVersion: '0.6.5',
        },
        {
          depName: 'minitest',
          currentValue: '"~> 5.0"',
          lockedVersion: '5.13.0',
          depTypes: ['test'],
        },
        {
          depName: 'byebug',
          lockedVersion: '11.0.1',
          depTypes: ['test'],
        },
      ]);
      expect(
        res?.deps.every(
          (dep) => isString(dep.lockedVersion) && isValid(dep.lockedVersion),
        ),
      ).toBeTrue();
      expect(res?.deps).toHaveLength(5);
    });

    it('parse mastodon Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(mastodonGemfileLock);
      const res = await extractPackageFile(mastodonGemfile, 'Gemfile');
      expect(res?.deps).toMatchObject([
        {
          depName: 'pkg-config',
          currentValue: "'~> 1.4'",
          lockedVersion: '1.4.0',
        },
        {
          depName: 'puma',
          currentValue: "'~> 4.3'",
          lockedVersion: '4.3.1',
        },
        {
          depName: 'rails',
          currentValue: "'~> 5.2.4'",
          lockedVersion: '5.2.4.1',
        },
        {
          depName: 'sprockets',
          currentValue: "'~> 3.7.2'",
          lockedVersion: '3.7.2',
        },
        {
          depName: 'thor',
          currentValue: "'~> 0.20'",
          lockedVersion: '0.20.3',
        },
        {
          depName: 'hamlit-rails',
          currentValue: "'~> 0.2'",
          lockedVersion: '0.2.3',
        },
        {
          depName: 'pg',
          currentValue: "'~> 1.2'",
          lockedVersion: '1.2.0',
        },
        {
          depName: 'makara',
          currentValue: "'~> 0.4'",
          lockedVersion: '0.4.1',
        },
        {
          depName: 'pghero',
          currentValue: "'~> 2.4'",
          lockedVersion: '2.4.1',
        },
        {
          depName: 'dotenv-rails',
          currentValue: "'~> 2.7'",
          lockedVersion: '2.7.5',
        },
        {
          depName: 'aws-sdk-s3',
          currentValue: "'~> 1.59'",
          lockedVersion: '1.59.0',
        },
        {
          depName: 'fog-core',
          currentValue: "'<= 2.1.0'",
          lockedVersion: '2.1.0',
        },
        {
          depName: 'fog-openstack',
          currentValue: "'~> 0.3'",
          lockedVersion: '0.3.7',
        },
        {
          depName: 'paperclip',
          currentValue: "'~> 6.0'",
          lockedVersion: '6.0.0',
        },
        {
          depName: 'paperclip-av-transcoder',
          currentValue: "'~> 0.6'",
          lockedVersion: '0.6.4',
        },
        {
          depName: 'streamio-ffmpeg',
          currentValue: "'~> 3.0'",
          lockedVersion: '3.0.2',
        },
        {
          depName: 'blurhash',
          currentValue: "'~> 0.1'",
          lockedVersion: '0.1.3',
        },
        {
          depName: 'active_model_serializers',
          currentValue: "'~> 0.10'",
          lockedVersion: '0.10.10',
        },
        {
          depName: 'addressable',
          currentValue: "'~> 2.7'",
          lockedVersion: '2.7.0',
        },
        {
          depName: 'bootsnap',
          currentValue: "'~> 1.4'",
          lockedVersion: '1.4.5',
        },
        {
          depName: 'browser',
          lockedVersion: '2.7.1',
        },
        {
          depName: 'charlock_holmes',
          currentValue: "'~> 0.7.7'",
          lockedVersion: '0.7.7',
        },
        {
          depName: 'iso-639',
          lockedVersion: '0.2.8',
        },
        {
          depName: 'chewy',
          currentValue: "'~> 5.1'",
          lockedVersion: '5.1.0',
        },
        {
          depName: 'cld3',
          currentValue: "'~> 3.2.6'",
          lockedVersion: '3.2.6',
        },
        {
          depName: 'devise',
          currentValue: "'~> 4.7'",
          lockedVersion: '4.7.1',
        },
        {
          depName: 'devise-two-factor',
          currentValue: "'~> 3.1'",
          lockedVersion: '3.1.0',
        },
        {
          depName: 'devise_pam_authenticatable2',
          currentValue: "'~> 9.2'",
          lockedVersion: '9.2.0',
          depTypes: ['pam_authentication', 'optional: true'],
        },
        {
          depName: 'net-ldap',
          currentValue: "'~> 0.16'",
          lockedVersion: '0.16.2',
        },
        {
          depName: 'omniauth-cas',
          currentValue: "'~> 1.1'",
          lockedVersion: '1.1.1',
        },
        {
          depName: 'omniauth-saml',
          currentValue: "'~> 1.10'",
          lockedVersion: '1.10.1',
        },
        {
          depName: 'omniauth',
          currentValue: "'~> 1.9'",
          lockedVersion: '1.9.0',
        },
        {
          depName: 'discard',
          currentValue: "'~> 1.1'",
          lockedVersion: '1.1.0',
        },
        {
          depName: 'doorkeeper',
          currentValue: "'~> 5.2'",
          lockedVersion: '5.2.3',
        },
        {
          depName: 'fast_blank',
          currentValue: "'~> 1.0'",
          lockedVersion: '1.0.0',
        },
        {
          depName: 'fastimage',
          lockedVersion: '2.1.7',
        },
        {
          depName: 'goldfinger',
          currentValue: "'~> 2.1'",
          lockedVersion: '2.1.0',
        },
        {
          depName: 'hiredis',
          currentValue: "'~> 0.6'",
          lockedVersion: '0.6.3',
        },
        {
          depName: 'redis-namespace',
          currentValue: "'~> 1.7'",
          lockedVersion: '1.7.0',
        },
        {
          depName: 'health_check',
          currentDigest: '0b799ead604f900ed50685e9b2d469cd2befba5b',
          datasource: 'git-refs',
          packageName: 'https://github.com/ianheggie/health_check',
        },
        {
          depName: 'htmlentities',
          currentValue: "'~> 4.3'",
          lockedVersion: '4.3.4',
        },
        {
          depName: 'http',
          currentValue: "'~> 3.3'",
          lockedVersion: '3.3.0',
        },
        {
          depName: 'http_accept_language',
          currentValue: "'~> 2.1'",
          lockedVersion: '2.1.1',
        },
        {
          depName: 'http_parser.rb',
          currentValue: "'~> 0.6'",
          currentDigest: '54b17ba8c7d8d20a16dfc65d1775241833219cf2',
          datasource: 'git-refs',
          packageName: 'https://github.com/tmm1/http_parser.rb',
        },
        {
          depName: 'httplog',
          currentValue: "'~> 1.3'",
          lockedVersion: '1.3.3',
        },
        {
          depName: 'idn-ruby',
          lockedVersion: '0.1.0',
        },
        {
          depName: 'kaminari',
          currentValue: "'~> 1.1'",
          lockedVersion: '1.1.1',
        },
        {
          depName: 'link_header',
          currentValue: "'~> 0.0'",
          lockedVersion: '0.0.8',
        },
        {
          depName: 'mime-types',
          currentValue: "'~> 3.3.1'",
          lockedVersion: '3.3.1',
        },
        {
          depName: 'nilsimsa',
          currentDigest: 'fd184883048b922b176939f851338d0a4971a532',
          datasource: 'git-refs',
          packageName: 'https://github.com/witgo/nilsimsa',
        },
        {
          depName: 'nokogiri',
          currentValue: "'~> 1.10'",
          lockedVersion: '1.10.7',
        },
        {
          depName: 'nsa',
          currentValue: "'~> 0.2'",
          lockedVersion: '0.2.7',
        },
        {
          depName: 'oj',
          currentValue: "'~> 3.10'",
          lockedVersion: '3.10.0',
        },
        {
          depName: 'ostatus2',
          currentValue: "'~> 2.0'",
          lockedVersion: '2.0.3',
        },
        {
          depName: 'ox',
          currentValue: "'~> 2.11'",
          lockedVersion: '2.11.0',
        },
        {
          depName: 'parslet',
          lockedVersion: '1.8.2',
        },
        {
          depName: 'parallel',
          currentValue: "'~> 1.19'",
          lockedVersion: '1.19.1',
        },
        {
          depName: 'posix-spawn',
          currentDigest: '58465d2e213991f8afb13b984854a49fcdcc980c',
          datasource: 'git-refs',
          packageName: 'https://github.com/rtomayko/posix-spawn',
        },
        {
          depName: 'pundit',
          currentValue: "'~> 2.1'",
          lockedVersion: '2.1.0',
        },
        {
          depName: 'premailer-rails',
          lockedVersion: '1.10.3',
        },
        {
          depName: 'rack-attack',
          currentValue: "'~> 6.2'",
          lockedVersion: '6.2.2',
        },
        {
          depName: 'rack-cors',
          currentValue: "'~> 1.1'",
          lockedVersion: '1.1.1',
        },
        {
          depName: 'rails-i18n',
          currentValue: "'~> 5.1'",
          lockedVersion: '5.1.3',
        },
        {
          depName: 'rails-settings-cached',
          currentValue: "'~> 0.6'",
          lockedVersion: '0.6.6',
        },
        {
          depName: 'redis',
          currentValue: "'~> 4.1'",
          lockedVersion: '4.1.3',
        },
        {
          depName: 'mario-redis-lock',
          currentValue: "'~> 1.2'",
          lockedVersion: '1.2.1',
        },
        {
          depName: 'rqrcode',
          currentValue: "'~> 0.10'",
          lockedVersion: '0.10.1',
        },
        {
          depName: 'ruby-progressbar',
          currentValue: "'~> 1.10'",
          lockedVersion: '1.10.1',
        },
        {
          depName: 'sanitize',
          currentValue: "'~> 5.1'",
          lockedVersion: '5.1.0',
        },
        {
          depName: 'sidekiq',
          currentValue: "'~> 5.2'",
          lockedVersion: '5.2.7',
        },
        {
          depName: 'sidekiq-scheduler',
          currentValue: "'~> 3.0'",
          lockedVersion: '3.0.0',
        },
        {
          depName: 'sidekiq-unique-jobs',
          currentValue: "'~> 6.0'",
          lockedVersion: '6.0.18',
        },
        {
          depName: 'sidekiq-bulk',
          currentValue: "'~>0.2.0'",
          lockedVersion: '0.2.0',
        },
        {
          depName: 'simple-navigation',
          currentValue: "'~> 4.1'",
          lockedVersion: '4.1.0',
        },
        {
          depName: 'simple_form',
          currentValue: "'~> 5.0'",
          lockedVersion: '5.0.1',
        },
        {
          depName: 'sprockets-rails',
          currentValue: "'~> 3.2'",
          lockedVersion: '3.2.1',
        },
        {
          depName: 'stoplight',
          currentValue: "'~> 2.2.0'",
          lockedVersion: '2.2.0',
        },
        {
          depName: 'strong_migrations',
          currentValue: "'~> 0.5'",
          lockedVersion: '0.5.1',
        },
        {
          depName: 'tty-command',
          currentValue: "'~> 0.9'",
          lockedVersion: '0.9.0',
        },
        {
          depName: 'tty-prompt',
          currentValue: "'~> 0.20'",
          lockedVersion: '0.20.0',
        },
        {
          depName: 'twitter-text',
          currentValue: "'~> 1.14'",
          lockedVersion: '1.14.7',
        },
        {
          depName: 'tzinfo-data',
          currentValue: "'~> 1.2019'",
          lockedVersion: '1.2019.3',
        },
        {
          depName: 'webpacker',
          currentValue: "'~> 4.2'",
          lockedVersion: '4.2.2',
        },
        {
          depName: 'webpush',
          lockedVersion: '0.3.8',
        },
        {
          depName: 'json-ld',
          currentDigest: 'e742697a0906e74e8bb777ef98137bc3955d981d',
          datasource: 'git-refs',
          packageName: 'https://github.com/ruby-rdf/json-ld.git',
        },
        {
          depName: 'json-ld-preloaded',
          currentValue: "'~> 3.0'",
          lockedVersion: '3.0.6',
        },
        {
          depName: 'rdf-normalize',
          currentValue: "'~> 0.3'",
          lockedVersion: '0.3.3',
        },
        {
          depName: 'fabrication',
          currentValue: "'~> 2.21'",
          lockedVersion: '2.21.0',
          depTypes: ['development', 'test'],
        },
        {
          depName: 'fuubar',
          currentValue: "'~> 2.5'",
          lockedVersion: '2.5.0',
          depTypes: ['development', 'test'],
        },
        {
          depName: 'i18n-tasks',
          currentValue: "'~> 0.9'",
          lockedVersion: '0.9.29',
          depTypes: ['development', 'test'],
        },
        {
          depName: 'pry-byebug',
          currentValue: "'~> 3.7'",
          lockedVersion: '3.7.0',
          depTypes: ['development', 'test'],
        },
        {
          depName: 'pry-rails',
          currentValue: "'~> 0.3'",
          lockedVersion: '0.3.9',
          depTypes: ['development', 'test'],
        },
        {
          depName: 'rspec-rails',
          currentValue: "'~> 3.9'",
          lockedVersion: '3.9.0',
          depTypes: ['development', 'test'],
        },
        {
          depName: 'private_address_check',
          currentValue: "'~> 0.5'",
          lockedVersion: '0.5.0',
          depTypes: ['production', 'test'],
        },
        {
          depName: 'capybara',
          currentValue: "'~> 3.29'",
          lockedVersion: '3.29.0',
          depTypes: ['test'],
        },
        {
          depName: 'climate_control',
          currentValue: "'~> 0.2'",
          lockedVersion: '0.2.0',
          depTypes: ['test'],
        },
        {
          depName: 'faker',
          currentValue: "'~> 2.10'",
          lockedVersion: '2.10.0',
          depTypes: ['test'],
        },
        {
          depName: 'microformats',
          currentValue: "'~> 4.2'",
          lockedVersion: '4.2.0',
          depTypes: ['test'],
        },
        {
          depName: 'rails-controller-testing',
          currentValue: "'~> 1.0'",
          lockedVersion: '1.0.4',
          depTypes: ['test'],
        },
        {
          depName: 'rspec-sidekiq',
          currentValue: "'~> 3.0'",
          lockedVersion: '3.0.3',
          depTypes: ['test'],
        },
        {
          depName: 'simplecov',
          currentValue: "'~> 0.17'",
          lockedVersion: '0.17.1',
          depTypes: ['test'],
        },
        {
          depName: 'webmock',
          currentValue: "'~> 3.7'",
          lockedVersion: '3.7.6',
          depTypes: ['test'],
        },
        {
          depName: 'parallel_tests',
          currentValue: "'~> 2.30'",
          lockedVersion: '2.30.0',
          depTypes: ['test'],
        },
        {
          depName: 'active_record_query_trace',
          currentValue: "'~> 1.7'",
          lockedVersion: '1.7',
          depTypes: ['development'],
        },
        {
          depName: 'annotate',
          currentValue: "'~> 3.0'",
          lockedVersion: '3.0.3',
          depTypes: ['development'],
        },
        {
          depName: 'better_errors',
          currentValue: "'~> 2.5'",
          lockedVersion: '2.5.1',
          depTypes: ['development'],
        },
        {
          depName: 'binding_of_caller',
          currentValue: "'~> 0.7'",
          lockedVersion: '0.8.0',
          depTypes: ['development'],
        },
        {
          depName: 'bullet',
          currentValue: "'~> 6.0'",
          lockedVersion: '6.0.2',
          depTypes: ['development'],
        },
        {
          depName: 'letter_opener',
          currentValue: "'~> 1.7'",
          lockedVersion: '1.7.0',
          depTypes: ['development'],
        },
        {
          depName: 'letter_opener_web',
          currentValue: "'~> 1.3'",
          lockedVersion: '1.3.4',
          depTypes: ['development'],
        },
        {
          depName: 'memory_profiler',
          lockedVersion: '0.9.14',
          depTypes: ['development'],
        },
        {
          depName: 'rubocop',
          currentValue: "'~> 0.78'",
          lockedVersion: '0.78.0',
          depTypes: ['development'],
        },
        {
          depName: 'rubocop-rails',
          currentValue: "'~> 2.4'",
          lockedVersion: '2.4.0',
          depTypes: ['development'],
        },
        {
          depName: 'brakeman',
          currentValue: "'~> 4.7'",
          lockedVersion: '4.7.2',
          depTypes: ['development'],
        },
        {
          depName: 'bundler-audit',
          currentValue: "'~> 0.6'",
          lockedVersion: '0.6.1',
          depTypes: ['development'],
        },
        {
          depName: 'capistrano',
          currentValue: "'~> 3.11'",
          lockedVersion: '3.11.2',
          depTypes: ['development'],
        },
        {
          depName: 'capistrano-rails',
          currentValue: "'~> 1.4'",
          lockedVersion: '1.4.0',
          depTypes: ['development'],
        },
        {
          depName: 'capistrano-rbenv',
          currentValue: "'~> 2.1'",
          lockedVersion: '2.1.4',
          depTypes: ['development'],
        },
        {
          depName: 'capistrano-yarn',
          currentValue: "'~> 2.0'",
          lockedVersion: '2.0.2',
          depTypes: ['development'],
        },
        {
          depName: 'derailed_benchmarks',
          lockedVersion: '1.4.3',
          depTypes: ['development'],
        },
        {
          depName: 'stackprof',
          lockedVersion: '0.2.15',
          depTypes: ['development'],
        },
        {
          depName: 'lograge',
          currentValue: "'~> 0.11'",
          lockedVersion: '0.11.2',
          depTypes: ['production'],
        },
        {
          depName: 'redis-rails',
          currentValue: "'~> 5.0'",
          lockedVersion: '5.0.2',
          depTypes: ['production'],
        },
        {
          depName: 'concurrent-ruby',
          lockedVersion: '1.1.5',
        },
        {
          depName: 'connection_pool',
          lockedVersion: '2.2.2',
        },
      ]);
      expect(
        res?.deps
          .filter((dep) =>
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion'),
          )
          .every(
            (dep) => isString(dep.lockedVersion) && isValid(dep.lockedVersion),
          ),
      ).toBeTrue();
      expect(res?.deps).toHaveLength(125);
    });

    it('parse Ruby CI Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(rubyCIGemfileLock);
      const res = await extractPackageFile(rubyCIGemfile, 'Gemfile');
      expect(res?.deps).toMatchObject([
        {
          depName: 'rails',
          currentValue: "'~> 5.2.1'",
          lockedVersion: '5.2.3',
        },
        {
          depName: 'puma',
          lockedVersion: '4.3.1',
        },
        {
          depName: 'bootsnap',
          lockedVersion: '1.4.5',
        },
        {
          depName: 'sass-rails',
          currentValue: "'~> 5.0'",
          lockedVersion: '5.1.0',
        },
        {
          depName: 'sass-rails-bootstrap',
          lockedVersion: '2.2.2.3',
        },
        {
          depName: 'jquery-rails',
          lockedVersion: '4.3.5',
        },
        {
          depName: 'uglifier',
          lockedVersion: '4.2.0',
        },
        {
          depName: 'foreman',
          lockedVersion: '0.86.0',
          depTypes: ['development'],
        },
        {
          depName: 'sqlite3',
          lockedVersion: '1.4.2',
          depTypes: ['development'],
        },
        {
          depName: 'listen',
          lockedVersion: '3.2.1',
          depTypes: ['development'],
        },
        {
          depName: 'pg',
          lockedVersion: '1.2.1',
          depTypes: ['production'],
        },
        {
          depName: 'newrelic_rpm',
          lockedVersion: '6.8.0.360',
          depTypes: ['production'],
        },
        {
          depName: 'sqreen',
          currentValue: "'< 1.17.2'",
          lockedVersion: '1.17.0',
          depTypes: ['production'],
        },
        {
          depName: 'airbrake',
          lockedVersion: '9.5.5',
          depTypes: ['production'],
        },
      ]);
      expect(
        res?.deps.every(
          (dep) => isString(dep.lockedVersion) && isValid(dep.lockedVersion),
        ),
      ).toBeTrue();
      expect(res?.deps).toHaveLength(14);
    });
  });

  it('parse Gitlab Foss Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(gitlabFossGemfileLock);
    const res = await extractPackageFile(gitlabFossGemfile, 'Gemfile');
    expect(res?.deps).toMatchObject([
      {
        depName: 'rails',
        currentValue: "'5.2.3'",
        lockedVersion: '5.2.3',
      },
      {
        depName: 'bootsnap',
        currentValue: "'~> 1.4'",
        lockedVersion: '1.4.5',
      },
      {
        depName: 'nakayoshi_fork',
        currentValue: "'~> 0.0.4'",
        lockedVersion: '0.0.4',
      },
      {
        depName: 'responders',
        currentValue: "'~> 3.0'",
        lockedVersion: '3.0.0',
      },
      {
        depName: 'sprockets',
        currentValue: "'~> 3.7.0'",
        lockedVersion: '3.7.2',
      },
      {
        depName: 'default_value_for',
        currentValue: "'~> 3.3.0'",
        lockedVersion: '3.3.0',
      },
      {
        depName: 'pg',
        currentValue: "'~> 1.1'",
        lockedVersion: '1.1.4',
      },
      {
        depName: 'rugged',
        currentValue: "'~> 0.28'",
        lockedVersion: '0.28.4.1',
      },
      {
        depName: 'grape-path-helpers',
        currentValue: "'~> 1.1'",
        lockedVersion: '1.1.0',
      },
      {
        depName: 'faraday',
        currentValue: "'~> 0.12'",
        lockedVersion: '0.12.2',
      },
      {
        depName: 'marginalia',
        currentValue: "'~> 1.8.0'",
        lockedVersion: '1.8.0',
      },
      {
        depName: 'devise',
        currentValue: "'~> 4.6'",
        lockedVersion: '4.7.1',
      },
      {
        depName: 'doorkeeper',
        currentValue: "'~> 4.3'",
        lockedVersion: '4.3.2',
      },
      {
        depName: 'doorkeeper-openid_connect',
        currentValue: "'~> 1.5'",
        lockedVersion: '1.5.0',
      },
      {
        depName: 'omniauth',
        currentValue: "'~> 1.8'",
        lockedVersion: '1.9.0',
      },
      {
        depName: 'omniauth-auth0',
        currentValue: "'~> 2.0.0'",
        lockedVersion: '2.0.0',
      },
      {
        depName: 'omniauth-azure-oauth2',
        currentValue: "'~> 0.0.9'",
        lockedVersion: '0.0.10',
      },
      {
        depName: 'omniauth-cas3',
        currentValue: "'~> 1.1.4'",
        lockedVersion: '1.1.4',
      },
      {
        depName: 'omniauth-facebook',
        currentValue: "'~> 4.0.0'",
        lockedVersion: '4.0.0',
      },
      {
        depName: 'omniauth-github',
        currentValue: "'~> 1.3'",
        lockedVersion: '1.3.0',
      },
      {
        depName: 'omniauth-gitlab',
        currentValue: "'~> 1.0.2'",
        lockedVersion: '1.0.3',
      },
      {
        depName: 'omniauth-google-oauth2',
        currentValue: "'~> 0.6.0'",
        lockedVersion: '0.6.0',
      },
      {
        depName: 'omniauth-kerberos',
        currentValue: "'~> 0.3.0'",
        lockedVersion: '0.3.0',
      },
      {
        depName: 'omniauth-oauth2-generic',
        currentValue: "'~> 0.2.2'",
        lockedVersion: '0.2.2',
      },
      {
        depName: 'omniauth-saml',
        currentValue: "'~> 1.10'",
        lockedVersion: '1.10.0',
      },
      {
        depName: 'omniauth-shibboleth',
        currentValue: "'~> 1.3.0'",
        lockedVersion: '1.3.0',
      },
      {
        depName: 'omniauth-twitter',
        currentValue: "'~> 1.4'",
        lockedVersion: '1.4.0',
      },
      {
        depName: 'omniauth_crowd',
        currentValue: "'~> 2.2.0'",
        lockedVersion: '2.2.3',
      },
      {
        depName: 'omniauth-authentiq',
        currentValue: "'~> 0.3.3'",
        lockedVersion: '0.3.3',
      },
      {
        depName: 'omniauth_openid_connect',
        currentValue: "'~> 0.3.3'",
        lockedVersion: '0.3.3',
      },
      {
        depName: 'omniauth-ultraauth',
        currentValue: "'~> 0.0.2'",
        lockedVersion: '0.0.2',
      },
      {
        depName: 'omniauth-salesforce',
        currentValue: "'~> 1.0.5'",
        lockedVersion: '1.0.5',
      },
      {
        depName: 'rack-oauth2',
        currentValue: "'~> 1.9.3'",
        lockedVersion: '1.9.3',
      },
      {
        depName: 'jwt',
        currentValue: "'~> 2.1.0'",
        lockedVersion: '2.1.0',
      },
      {
        depName: 'gssapi',
        lockedVersion: '1.2.0',
      },
      {
        depName: 'recaptcha',
        currentValue: "'~> 4.11'",
        lockedVersion: '4.13.1',
      },
      {
        depName: 'akismet',
        currentValue: "'~> 3.0'",
        lockedVersion: '3.0.0',
      },
      {
        depName: 'invisible_captcha',
        currentValue: "'~> 0.12.1'",
        lockedVersion: '0.12.1',
      },
      {
        depName: 'devise-two-factor',
        currentValue: "'~> 3.0.0'",
        lockedVersion: '3.0.0',
      },
      {
        depName: 'rqrcode-rails3',
        currentValue: "'~> 0.1.7'",
        lockedVersion: '0.1.7',
      },
      {
        depName: 'attr_encrypted',
        currentValue: "'~> 3.1.0'",
        lockedVersion: '3.1.0',
      },
      {
        depName: 'u2f',
        currentValue: "'~> 0.2.1'",
        lockedVersion: '0.2.1',
      },
      {
        depName: 'validates_hostname',
        currentValue: "'~> 1.0.6'",
        lockedVersion: '1.0.6',
      },
      {
        depName: 'rubyzip',
        currentValue: "'~> 1.3.0'",
        lockedVersion: '1.3.0',
      },
      {
        depName: 'acme-client',
        currentValue: "'~> 2.0.2'",
        lockedVersion: '2.0.2',
      },
      {
        depName: 'browser',
        currentValue: "'~> 2.5'",
        lockedVersion: '2.5.3',
      },
      {
        depName: 'gpgme',
        currentValue: "'~> 2.0.19'",
        lockedVersion: '2.0.19',
      },
      {
        depName: 'gitlab_omniauth-ldap',
        currentValue: "'~> 2.1.1'",
        lockedVersion: '2.1.1',
      },
      {
        depName: 'net-ldap',
        lockedVersion: '0.16.0',
      },
      {
        depName: 'grape',
        currentValue: "'~> 1.1.0'",
        lockedVersion: '1.1.0',
      },
      {
        depName: 'grape-entity',
        currentValue: "'~> 0.7.1'",
        lockedVersion: '0.7.1',
      },
      {
        depName: 'rack-cors',
        currentValue: "'~> 1.0.0'",
        lockedVersion: '1.0.2',
      },
      {
        depName: 'graphql',
        currentValue: "'~> 1.9.11'",
        lockedVersion: '1.9.11',
      },
      {
        depName: 'graphiql-rails',
        currentValue: "'~> 1.4.10'",
        lockedVersion: '1.4.10',
      },
      {
        depName: 'apollo_upload_server',
        currentValue: "'~> 2.0.0.beta3'",
        lockedVersion: '2.0.0.beta.3',
      },
      {
        depName: 'graphql-docs',
        currentValue: "'~> 1.6.0'",
        lockedVersion: '1.6.0',
      },
      {
        depName: 'hashie-forbidden_attributes',
        lockedVersion: '0.1.1',
      },
      {
        depName: 'kaminari',
        currentValue: "'~> 1.0'",
        lockedVersion: '1.0.1',
      },
      {
        depName: 'hamlit',
        currentValue: "'~> 2.11.0'",
        lockedVersion: '2.11.0',
      },
      {
        depName: 'carrierwave',
        currentValue: "'~> 1.3'",
        lockedVersion: '1.3.1',
      },
      {
        depName: 'mini_magick',
        lockedVersion: '4.9.5',
      },
      {
        depName: 'fog-aws',
        currentValue: "'~> 3.5'",
        lockedVersion: '3.5.2',
      },
      {
        depName: 'fog-core',
        currentValue: "'= 2.1.0'",
        lockedVersion: '2.1.0',
      },
      {
        depName: 'fog-google',
        currentValue: "'~> 1.9'",
        lockedVersion: '1.9.1',
      },
      {
        depName: 'fog-local',
        currentValue: "'~> 0.6'",
        lockedVersion: '0.6.0',
      },
      {
        depName: 'fog-openstack',
        currentValue: "'~> 1.0'",
        lockedVersion: '1.0.8',
      },
      {
        depName: 'fog-rackspace',
        currentValue: "'~> 0.1.1'",
        lockedVersion: '0.1.1',
      },
      {
        depName: 'fog-aliyun',
        currentValue: "'~> 0.3'",
        lockedVersion: '0.3.3',
      },
      {
        depName: 'google-api-client',
        currentValue: "'~> 0.23'",
        lockedVersion: '0.23.4',
      },
      {
        depName: 'unf',
        currentValue: "'~> 0.1.4'",
        lockedVersion: '0.1.4',
      },
      {
        depName: 'seed-fu',
        currentValue: "'~> 2.3.7'",
        lockedVersion: '2.3.7',
      },
      {
        depName: 'elasticsearch-model',
        currentValue: "'~> 0.1.9'",
        lockedVersion: '0.1.9',
      },
      {
        depName: 'elasticsearch-rails',
        currentValue: "'~> 0.1.9'",
        lockedVersion: '0.1.9',
      },
      {
        depName: 'elasticsearch-api',
        currentValue: "'5.0.3'",
        lockedVersion: '5.0.3',
      },
      {
        depName: 'aws-sdk',
        lockedVersion: '2.11.374',
      },
      {
        depName: 'faraday_middleware-aws-signers-v4',
        lockedVersion: '0.1.7',
      },
      {
        depName: 'html-pipeline',
        currentValue: "'~> 2.12'",
        lockedVersion: '2.12.2',
      },
      {
        depName: 'deckar01-task_list',
        currentValue: "'2.3.1'",
        lockedVersion: '2.3.1',
      },
      {
        depName: 'gitlab-markup',
        currentValue: "'~> 1.7.0'",
        lockedVersion: '1.7.0',
      },
      {
        depName: 'github-markup',
        currentValue: "'~> 1.7.0'",
        lockedVersion: '1.7.0',
      },
      {
        depName: 'commonmarker',
        currentValue: "'~> 0.20'",
        lockedVersion: '0.20.1',
      },
      {
        depName: 'RedCloth',
        currentValue: "'~> 4.3.2'",
        lockedVersion: '4.3.2',
      },
      {
        depName: 'rdoc',
        currentValue: "'~> 6.1.2'",
        lockedVersion: '6.1.2',
      },
      {
        depName: 'org-ruby',
        currentValue: "'~> 0.9.12'",
        lockedVersion: '0.9.12',
      },
      {
        depName: 'creole',
        currentValue: "'~> 0.5.0'",
        lockedVersion: '0.5.0',
      },
      {
        depName: 'wikicloth',
        currentValue: "'0.8.1'",
        lockedVersion: '0.8.1',
      },
      {
        depName: 'asciidoctor',
        currentValue: "'~> 2.0.10'",
        lockedVersion: '2.0.10',
      },
      {
        depName: 'asciidoctor-include-ext',
        currentValue: "'~> 0.3.1'",
        lockedVersion: '0.3.1',
      },
      {
        depName: 'asciidoctor-plantuml',
        currentValue: "'0.0.10'",
        lockedVersion: '0.0.10',
      },
      {
        depName: 'rouge',
        currentValue: "'~> 3.11.0'",
        lockedVersion: '3.11.0',
      },
      {
        depName: 'truncato',
        currentValue: "'~> 0.7.11'",
        lockedVersion: '0.7.11',
      },
      {
        depName: 'bootstrap_form',
        currentValue: "'~> 4.2.0'",
        lockedVersion: '4.2.0',
      },
      {
        depName: 'nokogiri',
        currentValue: "'~> 1.10.5'",
        lockedVersion: '1.10.7',
      },
      {
        depName: 'escape_utils',
        currentValue: "'~> 1.1'",
        lockedVersion: '1.2.1',
      },
      {
        depName: 'icalendar',
        lockedVersion: '2.4.1',
      },
      {
        depName: 'diffy',
        currentValue: "'~> 3.1.0'",
        lockedVersion: '3.1.0',
      },
      {
        depName: 'diff_match_patch',
        currentValue: "'~> 0.1.0'",
        lockedVersion: '0.1.0',
      },
      {
        depName: 'rack',
        currentValue: "'~> 2.0.7'",
        lockedVersion: '2.0.7',
      },
      {
        depName: 'unicorn',
        currentValue: "'~> 5.4.1'",
        lockedVersion: '5.4.1',
        depTypes: ['unicorn'],
      },
      {
        depName: 'unicorn-worker-killer',
        currentValue: "'~> 0.4.4'",
        lockedVersion: '0.4.4',
        depTypes: ['unicorn'],
      },
      {
        depName: 'gitlab-puma',
        currentValue: "'~> 4.3.1.gitlab.2'",
        lockedVersion: '4.3.1.gitlab.2',
        depTypes: ['puma'],
      },
      {
        depName: 'gitlab-puma_worker_killer',
        currentValue: "'~> 0.1.1.gitlab.1'",
        lockedVersion: '0.1.1.gitlab.1',
        depTypes: ['puma'],
      },
      {
        depName: 'rack-timeout',
        lockedVersion: '0.5.1',
        depTypes: ['puma'],
      },
      {
        depName: 'state_machines-activerecord',
        currentValue: "'~> 0.6.0'",
        lockedVersion: '0.6.0',
      },
      {
        depName: 'acts-as-taggable-on',
        currentValue: "'~> 6.0'",
        lockedVersion: '6.5.0',
      },
      {
        depName: 'sidekiq',
        currentValue: "'~> 5.2.7'",
        lockedVersion: '5.2.7',
      },
      {
        depName: 'sidekiq-cron',
        currentValue: "'~> 1.0'",
        lockedVersion: '1.0.4',
      },
      {
        depName: 'redis-namespace',
        currentValue: "'~> 1.6.0'",
        lockedVersion: '1.6.0',
      },
      {
        depName: 'gitlab-sidekiq-fetcher',
        currentValue: "'0.5.2'",
        lockedVersion: '0.5.2',
      },
      {
        depName: 'fugit',
        currentValue: "'~> 1.2.1'",
        lockedVersion: '1.2.1',
      },
      {
        depName: 'httparty',
        currentValue: "'~> 0.16.4'",
        lockedVersion: '0.16.4',
      },
      {
        depName: 'rainbow',
        currentValue: "'~> 3.0'",
        lockedVersion: '3.0.0',
      },
      {
        depName: 'ruby-progressbar',
        lockedVersion: '1.10.1',
      },
      {
        depName: 'settingslogic',
        currentValue: "'~> 2.0.9'",
        lockedVersion: '2.0.9',
      },
      {
        depName: 're2',
        currentValue: "'~> 1.1.1'",
        lockedVersion: '1.1.1',
      },
      {
        depName: 'version_sorter',
        currentValue: "'~> 2.2.4'",
        lockedVersion: '2.2.4',
      },
      {
        depName: 'js_regex',
        currentValue: "'~> 3.1'",
        lockedVersion: '3.1.1',
      },
      {
        depName: 'device_detector',
        lockedVersion: '1.0.0',
      },
      {
        depName: 'redis',
        currentValue: "'~> 4.0'",
        lockedVersion: '4.1.3',
      },
      {
        depName: 'connection_pool',
        currentValue: "'~> 2.0'",
        lockedVersion: '2.2.2',
      },
      {
        depName: 'redis-rails',
        currentValue: "'~> 5.0.2'",
        lockedVersion: '5.0.2',
      },
      {
        depName: 'discordrb-webhooks-blackst0ne',
        currentValue: "'~> 3.3'",
        lockedVersion: '3.3.0',
      },
      {
        depName: 'hipchat',
        currentValue: "'~> 1.5.0'",
        lockedVersion: '1.5.2',
      },
      {
        depName: 'jira-ruby',
        currentValue: "'~> 1.7'",
        lockedVersion: '1.7.1',
      },
      {
        depName: 'atlassian-jwt',
        currentValue: "'~> 0.2.0'",
        lockedVersion: '0.2.0',
      },
      {
        depName: 'flowdock',
        currentValue: "'~> 0.7'",
        lockedVersion: '0.7.1',
      },
      {
        depName: 'slack-notifier',
        currentValue: "'~> 1.5.1'",
        lockedVersion: '1.5.1',
      },
      {
        depName: 'hangouts-chat',
        currentValue: "'~> 0.0.5'",
        lockedVersion: '0.0.5',
      },
      {
        depName: 'asana',
        currentValue: "'~> 0.9'",
        lockedVersion: '0.9.3',
      },
      {
        depName: 'ruby-fogbugz',
        currentValue: "'~> 0.2.1'",
        lockedVersion: '0.2.1',
      },
      {
        depName: 'kubeclient',
        currentValue: "'~> 4.4.0'",
        lockedVersion: '4.4.0',
      },
      {
        depName: 'sanitize',
        currentValue: "'~> 4.6'",
        lockedVersion: '4.6.6',
      },
      {
        depName: 'babosa',
        currentValue: "'~> 1.0.2'",
        lockedVersion: '1.0.2',
      },
      {
        depName: 'loofah',
        currentValue: "'~> 2.2'",
        lockedVersion: '2.4.0',
      },
      {
        depName: 'licensee',
        currentValue: "'~> 8.9'",
        lockedVersion: '8.9.2',
      },
      {
        depName: 'ace-rails-ap',
        currentValue: "'~> 4.1.0'",
        lockedVersion: '4.1.2',
      },
      {
        depName: 'charlock_holmes',
        currentValue: "'~> 0.7.5'",
        lockedVersion: '0.7.6',
      },
      {
        depName: 'mimemagic',
        currentValue: "'~> 0.3.2'",
        lockedVersion: '0.3.2',
      },
      {
        depName: 'fast_blank',
        lockedVersion: '1.0.0',
      },
      {
        depName: 'gitlab-chronic',
        currentValue: "'~> 0.10.5'",
        lockedVersion: '0.10.5',
      },
      {
        depName: 'gitlab_chronic_duration',
        currentValue: "'~> 0.10.6.2'",
        lockedVersion: '0.10.6.2',
      },
      {
        depName: 'webpack-rails',
        currentValue: "'~> 0.9.10'",
        lockedVersion: '0.9.11',
      },
      {
        depName: 'rack-proxy',
        currentValue: "'~> 0.6.0'",
        lockedVersion: '0.6.0',
      },
      {
        depName: 'sassc-rails',
        currentValue: "'~> 2.1.0'",
        lockedVersion: '2.1.0',
      },
      {
        depName: 'uglifier',
        currentValue: "'~> 2.7.2'",
        lockedVersion: '2.7.2',
      },
      {
        depName: 'addressable',
        currentValue: "'~> 2.5.2'",
        lockedVersion: '2.5.2',
      },
      {
        depName: 'font-awesome-rails',
        currentValue: "'~> 4.7'",
        lockedVersion: '4.7.0.5',
      },
      {
        depName: 'gemojione',
        currentValue: "'~> 3.3'",
        lockedVersion: '3.3.0',
      },
      {
        depName: 'gon',
        currentValue: "'~> 6.2'",
        lockedVersion: '6.2.0',
      },
      {
        depName: 'request_store',
        currentValue: "'~> 1.3'",
        lockedVersion: '1.3.1',
      },
      {
        depName: 'base32',
        currentValue: "'~> 0.3.0'",
        lockedVersion: '0.3.2',
      },
      {
        depName: 'gitlab-license',
        currentValue: '"~> 1.0"',
        lockedVersion: '1.0.0',
      },
      {
        depName: 'rack-attack',
        currentValue: "'~> 6.2.0'",
        lockedVersion: '6.2.0',
      },
      {
        depName: 'sentry-raven',
        currentValue: "'~> 2.9'",
        lockedVersion: '2.9.0',
      },
      {
        depName: 'premailer-rails',
        currentValue: "'~> 1.10.3'",
        lockedVersion: '1.10.3',
      },
      {
        depName: 'gitlab-labkit',
        currentValue: "'0.8.0'",
        lockedVersion: '0.8.0',
      },
      {
        depName: 'ruby_parser',
        currentValue: "'~> 3.8'",
        lockedVersion: '3.13.1',
      },
      {
        depName: 'rails-i18n',
        currentValue: "'~> 5.1'",
        lockedVersion: '5.1.1',
      },
      {
        depName: 'gettext_i18n_rails',
        currentValue: "'~> 1.8.0'",
        lockedVersion: '1.8.0',
      },
      {
        depName: 'gettext_i18n_rails_js',
        currentValue: "'~> 1.3'",
        lockedVersion: '1.3.0',
      },
      {
        depName: 'gettext',
        currentValue: "'~> 3.2.2'",
        lockedVersion: '3.2.9',
      },
      {
        depName: 'batch-loader',
        currentValue: "'~> 1.4.0'",
        lockedVersion: '1.4.0',
      },
      {
        depName: 'peek',
        currentValue: "'~> 1.1'",
        lockedVersion: '1.1.0',
      },
      {
        depName: 'snowplow-tracker',
        currentValue: "'~> 0.6.1'",
        lockedVersion: '0.6.1',
      },
      {
        depName: 'derailed_benchmarks',
        lockedVersion: '1.3.5',
      },
      {
        depName: 'method_source',
        currentValue: "'~> 0.8'",
        lockedVersion: '0.9.2',
        depTypes: ['metrics'],
      },
      {
        depName: 'influxdb',
        currentValue: "'~> 0.2'",
        lockedVersion: '0.2.3',
        depTypes: ['metrics'],
      },
      {
        depName: 'prometheus-client-mmap',
        currentValue: "'~> 0.9.10'",
        lockedVersion: '0.9.10',
        depTypes: ['metrics'],
      },
      {
        depName: 'raindrops',
        currentValue: "'~> 0.18'",
        lockedVersion: '0.19.0',
        depTypes: ['metrics'],
      },
      {
        depName: 'brakeman',
        currentValue: "'~> 4.2'",
        lockedVersion: '4.2.1',
        depTypes: ['development'],
      },
      {
        depName: 'danger',
        currentValue: "'~> 6.0'",
        lockedVersion: '6.0.9',
        depTypes: ['development'],
      },
      {
        depName: 'letter_opener_web',
        currentValue: "'~> 1.3.4'",
        lockedVersion: '1.3.4',
        depTypes: ['development'],
      },
      {
        depName: 'rblineprof',
        currentValue: "'~> 0.3.6'",
        lockedVersion: '0.3.6',
        depTypes: ['development'],
      },
      {
        depName: 'better_errors',
        currentValue: "'~> 2.5.0'",
        lockedVersion: '2.5.0',
        depTypes: ['development'],
      },
      {
        depName: 'binding_of_caller',
        currentValue: "'~> 0.8.0'",
        lockedVersion: '0.8.0',
        depTypes: ['development'],
      },
      {
        depName: 'thin',
        currentValue: "'~> 1.7.0'",
        lockedVersion: '1.7.2',
        depTypes: ['development'],
      },
      {
        depName: 'bullet',
        currentValue: "'~> 6.0.2'",
        lockedVersion: '6.0.2',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'pry-byebug',
        currentValue: "'~> 3.5.1'",
        lockedVersion: '3.5.1',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'pry-rails',
        currentValue: "'~> 0.3.4'",
        lockedVersion: '0.3.6',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'awesome_print',
        lockedVersion: '1.8.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'database_cleaner',
        currentValue: "'~> 1.7.0'",
        lockedVersion: '1.7.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'factory_bot_rails',
        currentValue: "'~> 5.1.0'",
        lockedVersion: '5.1.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'rspec-rails',
        currentValue: "'~> 4.0.0.beta3'",
        lockedVersion: '4.0.0.beta3',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'minitest',
        currentValue: "'~> 5.11.0'",
        lockedVersion: '5.11.3',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'ffaker',
        currentValue: "'~> 2.10'",
        lockedVersion: '2.10.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'spring',
        currentValue: "'~> 2.0.0'",
        lockedVersion: '2.0.2',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'spring-commands-rspec',
        currentValue: "'~> 1.0.4'",
        lockedVersion: '1.0.4',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'gitlab-styles',
        currentValue: "'~> 3.1.0'",
        lockedVersion: '3.1.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'rubocop',
        currentValue: "'~> 0.74.0'",
        lockedVersion: '0.74.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'rubocop-performance',
        currentValue: "'~> 1.4.1'",
        lockedVersion: '1.4.1',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'rubocop-rspec',
        currentValue: "'~> 1.37.0'",
        lockedVersion: '1.37.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'scss_lint',
        currentValue: "'~> 0.56.0'",
        lockedVersion: '0.56.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'haml_lint',
        currentValue: "'~> 0.34.0'",
        lockedVersion: '0.34.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'simplecov',
        currentValue: "'~> 0.16.1'",
        lockedVersion: '0.16.1',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'bundler-audit',
        currentValue: "'~> 0.5.0'",
        lockedVersion: '0.5.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'benchmark-ips',
        currentValue: "'~> 2.3.0'",
        lockedVersion: '2.3.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'knapsack',
        currentValue: "'~> 1.17'",
        lockedVersion: '1.17.0',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'stackprof',
        currentValue: "'~> 0.2.13'",
        lockedVersion: '0.2.13',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'simple_po_parser',
        currentValue: "'~> 1.1.2'",
        lockedVersion: '1.1.2',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'timecop',
        currentValue: "'~> 0.8.0'",
        lockedVersion: '0.8.1',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'png_quantizator',
        currentValue: "'~> 0.2.1'",
        lockedVersion: '0.2.1',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'parallel',
        currentValue: "'~> 1.17.0'",
        lockedVersion: '1.19.1',
        depTypes: ['development', 'test'],
      },
      {
        depName: 'license_finder',
        currentValue: "'~> 5.4'",
        lockedVersion: '5.4.0',
        depTypes: ['development', 'test', 'omnibus'],
      },
      {
        depName: 'fuubar',
        currentValue: "'~> 2.2.0'",
        lockedVersion: '2.2.0',
        depTypes: ['test'],
      },
      {
        depName: 'rspec-retry',
        currentValue: "'~> 0.6.1'",
        lockedVersion: '0.6.1',
        depTypes: ['test'],
      },
      {
        depName: 'rspec_profiling',
        currentValue: "'~> 0.0.5'",
        lockedVersion: '0.0.5',
        depTypes: ['test'],
      },
      {
        depName: 'rspec-set',
        currentValue: "'~> 0.1.3'",
        lockedVersion: '0.1.3',
        depTypes: ['test'],
      },
      {
        depName: 'rspec-parameterized',
        lockedVersion: '0.4.2',
        depTypes: ['test'],
      },
      {
        depName: 'capybara',
        currentValue: "'~> 3.22.0'",
        lockedVersion: '3.22.0',
        depTypes: ['test'],
      },
      {
        depName: 'capybara-screenshot',
        currentValue: "'~> 1.0.22'",
        lockedVersion: '1.0.22',
        depTypes: ['test'],
      },
      {
        depName: 'selenium-webdriver',
        currentValue: "'~> 3.142'",
        lockedVersion: '3.142.6',
        depTypes: ['test'],
      },
      {
        depName: 'shoulda-matchers',
        currentValue: "'~> 4.0.1'",
        lockedVersion: '4.0.1',
        depTypes: ['test'],
      },
      {
        depName: 'email_spec',
        currentValue: "'~> 2.2.0'",
        lockedVersion: '2.2.0',
        depTypes: ['test'],
      },
      {
        depName: 'json-schema',
        currentValue: "'~> 2.8.0'",
        lockedVersion: '2.8.0',
        depTypes: ['test'],
      },
      {
        depName: 'webmock',
        currentValue: "'~> 3.5.1'",
        lockedVersion: '3.5.1',
        depTypes: ['test'],
      },
      {
        depName: 'rails-controller-testing',
        lockedVersion: '1.0.4',
        depTypes: ['test'],
      },
      {
        depName: 'concurrent-ruby',
        currentValue: "'~> 1.1'",
        lockedVersion: '1.1.5',
        depTypes: ['test'],
      },
      {
        depName: 'test-prof',
        currentValue: "'~> 0.10.0'",
        lockedVersion: '0.10.0',
        depTypes: ['test'],
      },
      {
        depName: 'rspec_junit_formatter',
        lockedVersion: '0.4.1',
        depTypes: ['test'],
      },
      {
        depName: 'guard-rspec',
        lockedVersion: '4.7.3',
        depTypes: ['test'],
      },
      {
        depName: 'octokit',
        currentValue: "'~> 4.9'",
        lockedVersion: '4.9.0',
      },
      {
        depName: 'mail_room',
        currentValue: "'~> 0.10.0'",
        lockedVersion: '0.10.0',
      },
      {
        depName: 'email_reply_trimmer',
        currentValue: "'~> 0.1'",
        lockedVersion: '0.1.6',
      },
      {
        depName: 'html2text',
        lockedVersion: '0.2.0',
      },
      {
        depName: 'ruby-prof',
        currentValue: "'~> 1.0.0'",
        lockedVersion: '1.0.0',
      },
      {
        depName: 'rbtrace',
        currentValue: "'~> 0.4'",
        lockedVersion: '0.4.11',
      },
      {
        depName: 'memory_profiler',
        currentValue: "'~> 0.9'",
        lockedVersion: '0.9.13',
      },
      {
        depName: 'benchmark-memory',
        currentValue: "'~> 0.1'",
        lockedVersion: '0.1.2',
      },
      {
        depName: 'activerecord-explain-analyze',
        currentValue: "'~> 0.1'",
        lockedVersion: '0.1.0',
      },
      {
        depName: 'oauth2',
        currentValue: "'~> 1.4'",
        lockedVersion: '1.4.1',
      },
      {
        depName: 'health_check',
        currentValue: "'~> 2.6.0'",
        lockedVersion: '2.6.0',
      },
      {
        depName: 'vmstat',
        currentValue: "'~> 2.3.0'",
        lockedVersion: '2.3.0',
      },
      {
        depName: 'sys-filesystem',
        currentValue: "'~> 1.1.6'",
        lockedVersion: '1.1.6',
      },
      {
        depName: 'net-ntp',
        lockedVersion: '2.1.3',
      },
      {
        depName: 'net-ssh',
        currentValue: "'~> 5.2'",
        lockedVersion: '5.2.0',
      },
      {
        depName: 'sshkey',
        currentValue: "'~> 2.0'",
        lockedVersion: '2.0.0',
      },
      {
        depName: 'ed25519',
        currentValue: "'~> 1.2'",
        lockedVersion: '1.2.4',
        depTypes: ['ed25519'],
      },
      {
        depName: 'bcrypt_pbkdf',
        currentValue: "'~> 1.0'",
        lockedVersion: '1.0.0',
        depTypes: ['ed25519'],
      },
      {
        depName: 'gitaly',
        currentValue: "'~> 1.73.0'",
        lockedVersion: '1.73.0',
      },
      {
        depName: 'grpc',
        currentValue: "'~> 1.24.0'",
        lockedVersion: '1.24.0',
      },
      {
        depName: 'google-protobuf',
        currentValue: "'~> 3.8.0'",
        lockedVersion: '3.8.0',
      },
      {
        depName: 'toml-rb',
        currentValue: "'~> 1.0.0'",
        lockedVersion: '1.0.0',
      },
      {
        depName: 'flipper',
        currentValue: "'~> 0.17.1'",
        lockedVersion: '0.17.1',
      },
      {
        depName: 'flipper-active_record',
        currentValue: "'~> 0.17.1'",
        lockedVersion: '0.17.1',
      },
      {
        depName: 'flipper-active_support_cache_store',
        currentValue: "'~> 0.17.1'",
        lockedVersion: '0.17.1',
      },
      {
        depName: 'unleash',
        currentValue: "'~> 0.1.5'",
        lockedVersion: '0.1.5',
      },
      {
        depName: 'lograge',
        currentValue: "'~> 0.5'",
        lockedVersion: '0.10.0',
      },
      {
        depName: 'grape_logging',
        currentValue: "'~> 1.7'",
        lockedVersion: '1.7.0',
      },
      {
        depName: 'gitlab-net-dns',
        currentValue: "'~> 0.9.1'",
        lockedVersion: '0.9.1',
      },
      {
        depName: 'countries',
        currentValue: "'~> 3.0'",
        lockedVersion: '3.0.0',
      },
      {
        depName: 'retriable',
        currentValue: "'~> 3.1.2'",
        lockedVersion: '3.1.2',
      },
      {
        depName: 'liquid',
        currentValue: "'~> 4.0'",
        lockedVersion: '4.0.3',
      },
    ]);
    expect(
      res?.deps.every(
        (dep) => isString(dep.lockedVersion) && isValid(dep.lockedVersion),
      ),
    ).toBeTrue();
    expect(res?.deps).toHaveLength(252);
  });

  it('parse source blocks in Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(sourceBlockGemfile);
    const res = await extractPackageFile(sourceBlockGemfile, 'Gemfile');
    expect(res).toMatchObject({
      registryUrls: [],
      deps: [
        {
          depName: 'sfn_my_dep1',
          currentValue: '"~> 1"',
          registryUrls: [
            'https://hub.tech.my.domain.de/artifactory/api/gems/my-gems-prod-local/',
          ],
        },
        {
          depName: 'sfn_my_dep2',
          currentValue: '"~> 1"',
          registryUrls: [
            'https://hub.tech.my.domain.de/artifactory/api/gems/my-gems-prod-local/',
          ],
        },
      ],
    });
  });

  it('parse source blocks with spaces in Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(sourceBlockWithNewLinesGemfileLock);
    const res = await extractPackageFile(
      sourceBlockWithNewLinesGemfile,
      'Gemfile',
    );
    expect(res).toMatchObject({
      registryUrls: [],
      deps: [
        {
          depName: 'rubocop',
          lockedVersion: '0.68.1',
          registryUrls: ['https://rubygems.org'],
        },
        {
          depName: 'brakeman',
          lockedVersion: '4.4.0',
          registryUrls: ['https://rubygems.org'],
        },
      ],
    });
    expect(res?.deps).toHaveLength(2);
  });

  it('parses source blocks with groups in Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(sourceBlockWithGroupsGemfile);
    const res = await extractPackageFile(
      sourceBlockWithGroupsGemfile,
      'Gemfile',
    );
    expect(res?.deps).toMatchObject([
      { depName: 'internal_test_gem', currentValue: '"~> 1"' },
      { depName: 'internal_production_gem', currentValue: '"~> 1"' },
      { depName: 'sfn_my_dep1', currentValue: '"~> 1"' },
      { depName: 'sfn_my_dep2', currentValue: '"~> 1"' },
    ]);
  });

  it('parses source variable in Gemfile', async () => {
    const sourceVariableGemfile = codeBlock`
      foo = 'https://gems.foo.com'
      bar = 'https://gems.bar.com'

      source foo

      source bar do
        gem "some_internal_gem"
      end
    `;

    fs.readLocalFile.mockResolvedValueOnce(sourceVariableGemfile);
    const res = await extractPackageFile(sourceVariableGemfile, 'Gemfile');
    expect(res).toMatchObject({
      registryUrls: ['https://gems.foo.com'],
      deps: [
        {
          depName: 'some_internal_gem',
          registryUrls: ['https://gems.bar.com'],
        },
      ],
    });
  });

  it('parses inline source in Gemfile', async () => {
    const sourceInlineGemfile = codeBlock`
      baz = 'https://gems.baz.com'
      gem 'inline_gem'
      gem "inline_source_gem", source: 'https://gems.foo.com'
      gem 'inline_source_gem_with_version', "~> 1", source: 'https://gems.bar.com'
      gem 'inline_source_gem_with_variable_source', source: baz
      gem 'inline_source_gem_with_variable_source_and_require_after', source: baz, require: %w[inline_source_gem]
      gem "inline_source_gem_with_require_after", source: 'https://gems.foo.com', require: %w[inline_source_gem]
      gem "inline_source_gem_with_require_before", require: %w[inline_source_gem], source: 'https://gems.foo.com'
      gem "inline_source_gem_with_group_before", group: :production, source: 'https://gems.foo.com'
      `;
    fs.readLocalFile.mockResolvedValueOnce(sourceInlineGemfile);
    const res = await extractPackageFile(sourceInlineGemfile, 'Gemfile');
    expect(res).toMatchObject({
      deps: [
        {
          depName: 'inline_gem',
        },
        {
          depName: 'inline_source_gem',
          registryUrls: ['https://gems.foo.com'],
        },
        {
          depName: 'inline_source_gem_with_version',
          currentValue: '"~> 1"',
          registryUrls: ['https://gems.bar.com'],
        },
        {
          depName: 'inline_source_gem_with_variable_source',
          registryUrls: ['https://gems.baz.com'],
        },
        {
          depName: 'inline_source_gem_with_variable_source_and_require_after',
          registryUrls: ['https://gems.baz.com'],
        },
        {
          depName: 'inline_source_gem_with_require_after',
          registryUrls: ['https://gems.foo.com'],
        },
        {
          depName: 'inline_source_gem_with_require_before',
          registryUrls: ['https://gems.foo.com'],
        },
        {
          depName: 'inline_source_gem_with_group_before',
          registryUrls: ['https://gems.foo.com'],
        },
      ],
    });
  });

  it('parses git refs in Gemfile', async () => {
    const gitRefGemfile = codeBlock`
      gem 'foo', git: 'https://github.com/foo/foo', ref: 'fd184883048b922b176939f851338d0a4971a532'
      gem 'bar', git: 'https://github.com/bar/bar', tag: 'v1.0.0'
      gem 'baz', github: 'baz/baz', branch: 'master'
      `;

    fs.readLocalFile.mockResolvedValueOnce(gitRefGemfile);
    const res = await extractPackageFile(gitRefGemfile, 'Gemfile');
    expect(res).toMatchObject({
      deps: [
        {
          depName: 'foo',
          packageName: 'https://github.com/foo/foo',
          sourceUrl: 'https://github.com/foo/foo',
          currentDigest: 'fd184883048b922b176939f851338d0a4971a532',
          datasource: 'git-refs',
        },
        {
          depName: 'bar',
          packageName: 'https://github.com/bar/bar',
          sourceUrl: 'https://github.com/bar/bar',
          currentValue: 'v1.0.0',
          datasource: 'git-refs',
        },
        {
          depName: 'baz',
          packageName: 'https://github.com/baz/baz',
          sourceUrl: 'https://github.com/baz/baz',
          currentValue: 'master',
          datasource: 'git-refs',
        },
      ],
    });
  });

  it('parses multiple current values Gemfile', async () => {
    const multipleValuesGemfile = codeBlock`
      gem 'gem_without_values'
      gem 'gem_with_one_value', ">= 3.0.5"
      gem 'gem_with_multiple_values', ">= 3.0.5", "< 3.2"
    `;
    fs.readLocalFile.mockResolvedValueOnce(multipleValuesGemfile);
    const res = await extractPackageFile(multipleValuesGemfile, 'Gemfile');
    expect(res).toMatchObject({
      deps: [
        {
          depName: 'gem_without_values',
        },
        {
          depName: 'gem_with_one_value',
          currentValue: '">= 3.0.5"',
        },
        {
          depName: 'gem_with_multiple_values',
          currentValue: '">= 3.0.5", "< 3.2"',
        },
      ],
    });
  });

  it('skips local gems in Gemfile', async () => {
    const pathGemfile = codeBlock`
      gem 'foo', path: 'vendor/foo'
      gem 'bar'
    `;

    fs.readLocalFile.mockResolvedValueOnce(pathGemfile);
    const res = await extractPackageFile(pathGemfile, 'Gemfile');
    expect(res).toMatchObject({
      deps: [
        {
          depName: 'foo',
          skipReason: 'internal-package',
        },
        {
          depName: 'bar',
        },
      ],
    });
  });
});
