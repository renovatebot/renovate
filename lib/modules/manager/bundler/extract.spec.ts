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

describe('modules/manager/bundler/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      await expect(
        extractPackageFile('nothing here', 'Gemfile'),
      ).resolves.toBeNull();
    });

    it('parses rails Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(railsGemfileLock);
      const res = await extractPackageFile(railsGemfile, 'Gemfile');
      expect(res?.deps).toHaveLength(68);
      // first gem: version constraint plus locked version
      expect(res?.deps[0]).toEqual({
        depName: 'rake',
        managerData: { lineNumber: 9 },
        datasource: 'rubygems',
        currentValue: '">= 11.1"',
        lockedVersion: '12.3.1',
      });
      // gem without a version constraint
      expect(res?.deps[3]).toEqual({
        depName: 'sass-rails',
        managerData: { lineNumber: 14 },
        datasource: 'rubygems',
        lockedVersion: '5.0.7',
      });
      // gem from a git source, no version
      expect(res?.deps[5]).toEqual({
        depName: 'webpacker',
        managerData: { lineNumber: 16 },
        datasource: 'git-refs',
        packageName: 'https://github.com/rails/webpacker',
        sourceUrl: 'https://github.com/rails/webpacker',
      });
      // gem inside a group block
      expect(res?.deps[10]).toEqual({
        depName: 'sdoc',
        managerData: { lineNumber: 32 },
        datasource: 'rubygems',
        currentValue: '"~> 1.0"',
        depTypes: ['doc'],
        lockedVersion: '1.0.0',
      });
      // gem with multiple version constraints
      expect(res?.deps[15]).toEqual({
        depName: 'listen',
        managerData: { lineNumber: 40 },
        datasource: 'rubygems',
        currentValue: '">= 3.0.5", "< 3.2"',
        lockedVersion: '3.1.5',
      });
      // git source with a branch, inside a group block
      expect(res?.deps[24]).toEqual({
        depName: 'queue_classic',
        managerData: { lineNumber: 54 },
        datasource: 'git-refs',
        packageName: 'https://github.com/rafaelfranca/queue_classic',
        sourceUrl: 'https://github.com/rafaelfranca/queue_classic',
        currentValue: 'update-pg',
        depTypes: ['job'],
      });
      // prerelease locked version, inside a group block
      expect(res?.deps[40]).toEqual({
        depName: 'azure-storage',
        managerData: { lineNumber: 82 },
        datasource: 'rubygems',
        depTypes: ['storage'],
        lockedVersion: '0.15.0.preview',
      });
      // git source with a locked version, outside and inside a group
      expect(res?.deps.slice(56, 58)).toEqual([
        {
          depName: 'activerecord-jdbcsqlite3-adapter',
          managerData: { lineNumber: 129 },
          datasource: 'git-refs',
          packageName: 'https://github.com/jruby/activerecord-jdbc-adapter',
          sourceUrl: 'https://github.com/jruby/activerecord-jdbc-adapter',
          currentValue: 'master',
          lockedVersion: '52.1',
        },
        {
          depName: 'activerecord-jdbcmysql-adapter',
          managerData: { lineNumber: 131 },
          datasource: 'git-refs',
          packageName: 'https://github.com/jruby/activerecord-jdbc-adapter',
          sourceUrl: 'https://github.com/jruby/activerecord-jdbc-adapter',
          currentValue: 'master',
          depTypes: ['db'],
          lockedVersion: '52.1',
        },
      ]);
      // gems missing from the lock file, a gem without any version, and the
      // last two gems
      expect(res?.deps.slice(63, 68)).toEqual([
        {
          depName: 'ruby-oci8',
          managerData: { lineNumber: 152 },
          datasource: 'rubygems',
          currentValue: '"~> 2.2"',
        },
        {
          depName: 'activerecord-oracle_enhanced-adapter',
          managerData: { lineNumber: 154 },
          datasource: 'git-refs',
          packageName: 'https://github.com/rsim/oracle-enhanced',
          sourceUrl: 'https://github.com/rsim/oracle-enhanced',
          currentValue: 'master',
        },
        {
          depName: 'ibm_db',
          managerData: { lineNumber: 158 },
          datasource: 'rubygems',
        },
        {
          depName: 'tzinfo-data',
          managerData: { lineNumber: 159 },
          datasource: 'rubygems',
          lockedVersion: '1.2018.7',
        },
        {
          depName: 'wdm',
          managerData: { lineNumber: 160 },
          datasource: 'rubygems',
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
    });

    it('parse mastodon Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(mastodonGemfileLock);
      const res = await extractPackageFile(mastodonGemfile, 'Gemfile');
      expect(res?.deps).toHaveLength(125);
      // first gem: version constraint plus locked version
      expect(res?.deps[0]).toEqual({
        depName: 'pkg-config',
        managerData: { lineNumber: 5 },
        datasource: 'rubygems',
        currentValue: "'~> 1.4'",
        lockedVersion: '1.4.0',
      });
      // gem without a version constraint
      expect(res?.deps[20]).toEqual({
        depName: 'browser',
        managerData: { lineNumber: 29 },
        datasource: 'rubygems',
        lockedVersion: '2.7.1',
      });
      // gem inside a group block with an option
      expect(res?.deps[27]).toEqual({
        depName: 'devise_pam_authenticatable2',
        managerData: { lineNumber: 38 },
        datasource: 'rubygems',
        currentValue: "'~> 9.2'",
        depTypes: ['pam_authentication', 'optional: true'],
        lockedVersion: '9.2.0',
      });
      // git source pinned to a commit
      expect(res?.deps[39]).toEqual({
        depName: 'health_check',
        managerData: { lineNumber: 53 },
        datasource: 'git-refs',
        packageName: 'https://github.com/ianheggie/health_check',
        sourceUrl: 'https://github.com/ianheggie/health_check',
        currentDigest: '0b799ead604f900ed50685e9b2d469cd2befba5b',
      });
      // git source with both a constraint and a commit
      expect(res?.deps[43]).toEqual({
        depName: 'http_parser.rb',
        managerData: { lineNumber: 57 },
        datasource: 'git-refs',
        currentValue: "'~> 0.6'",
        packageName: 'https://github.com/tmm1/http_parser.rb',
        sourceUrl: 'https://github.com/tmm1/http_parser.rb',
        currentDigest: '54b17ba8c7d8d20a16dfc65d1775241833219cf2',
      });
      // git source whose URL ends in .git
      expect(res?.deps[84]).toEqual({
        depName: 'json-ld',
        managerData: { lineNumber: 99 },
        datasource: 'git-refs',
        packageName: 'https://github.com/ruby-rdf/json-ld.git',
        sourceUrl: 'https://github.com/ruby-rdf/json-ld',
        currentDigest: 'e742697a0906e74e8bb777ef98137bc3955d981d',
      });
      // gem inside the development group
      expect(res?.deps[110]).toEqual({
        depName: 'memory_profiler',
        managerData: { lineNumber: 136 },
        datasource: 'rubygems',
        depTypes: ['development'],
        lockedVersion: '0.9.14',
      });
      // last gem
      expect(res?.deps[124]).toEqual({
        depName: 'connection_pool',
        managerData: { lineNumber: 157 },
        datasource: 'rubygems',
        lockedVersion: '2.2.2',
      });
      expect(
        res?.deps
          .filter((dep) =>
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion'),
          )
          .every(
            (dep) => isString(dep.lockedVersion) && isValid(dep.lockedVersion),
          ),
      ).toBeTrue();
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
    });
  });

  it('parse Gitlab Foss Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(gitlabFossGemfileLock);
    const res = await extractPackageFile(gitlabFossGemfile, 'Gemfile');
    expect(res?.deps).toHaveLength(252);
    // first gem: exact version constraint
    expect(res?.deps[0]).toEqual({
      depName: 'rails',
      managerData: { lineNumber: 2 },
      datasource: 'rubygems',
      currentValue: "'5.2.3'",
      lockedVersion: '5.2.3',
    });
    // gem without a version constraint
    expect(res?.deps[34]).toEqual({
      depName: 'gssapi',
      managerData: { lineNumber: 52 },
      datasource: 'rubygems',
      lockedVersion: '1.2.0',
    });
    // prerelease constraint and locked version
    expect(res?.deps[54]).toEqual({
      depName: 'apollo_upload_server',
      managerData: { lineNumber: 94 },
      datasource: 'rubygems',
      currentValue: "'~> 2.0.0.beta3'",
      lockedVersion: '2.0.0.beta.3',
    });
    // gem inside a group block
    expect(res?.deps[98]).toEqual({
      depName: 'unicorn',
      managerData: { lineNumber: 168 },
      datasource: 'rubygems',
      currentValue: "'~> 5.4.1'",
      depTypes: ['unicorn'],
      lockedVersion: '5.4.1',
    });
    // gem inside a group block without a version constraint
    expect(res?.deps[102]).toEqual({
      depName: 'rack-timeout',
      managerData: { lineNumber: 175 },
      datasource: 'rubygems',
      depTypes: ['puma'],
      lockedVersion: '0.5.1',
    });
    // gem inside multiple groups
    expect(res?.deps[182]).toEqual({
      depName: 'rspec-rails',
      managerData: { lineNumber: 357 },
      datasource: 'rubygems',
      currentValue: "'~> 4.0.0.beta3'",
      depTypes: ['development', 'test'],
      lockedVersion: '4.0.0.beta3',
    });
    // last gem
    expect(res?.deps[251]).toEqual({
      depName: 'liquid',
      managerData: { lineNumber: 484 },
      datasource: 'rubygems',
      currentValue: "'~> 4.0'",
      lockedVersion: '4.0.3',
    });
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
    const sourceBlockWithNewLinesGemfileLock = codeBlock`
      GEM
        remote: https://rubygems.org/
        specs:
          ast (2.4.0)
          brakeman (4.4.0)
          jaro_winkler (1.5.4)
          parallel (1.19.1)
          parser (2.7.0.2)
            ast (~> 2.4.0)
          rainbow (3.0.0)
          rubocop (0.68.1)
            jaro_winkler (~> 1.5.1)
            parallel (~> 1.10)
            parser (>= 2.5, != 2.5.1.1)
            rainbow (>= 2.2.2, < 4.0)
            ruby-progressbar (~> 1.7)
            unicode-display_width (>= 1.4.0, < 1.6)
          ruby-progressbar (1.10.1)
          unicode-display_width (1.5.0)

      PLATFORMS
        ruby

      DEPENDENCIES
        brakeman!
        rubocop!

      BUNDLED WITH
         1.16.6
    `;
    const sourceBlockWithNewLinesGemfile = codeBlock`
      # frozen_string_literal: true

      source 'https://rubygems.org' do
        gem 'rubocop'

        gem 'brakeman'
      end
    `;
    fs.readLocalFile.mockResolvedValueOnce(sourceBlockWithNewLinesGemfileLock);
    const res = await extractPackageFile(
      sourceBlockWithNewLinesGemfile,
      'Gemfile',
    );
    expect(res).toEqual({
      registryUrls: [],
      deps: [
        {
          depName: 'rubocop',
          datasource: 'rubygems',
          lockedVersion: '0.68.1',
          managerData: { lineNumber: 3 },
          registryUrls: ['https://rubygems.org'],
        },
        {
          depName: 'brakeman',
          datasource: 'rubygems',
          lockedVersion: '4.4.0',
          managerData: { lineNumber: 5 },
          registryUrls: ['https://rubygems.org'],
        },
      ],
      lockFiles: ['Gemfile.lock'],
    });
  });

  it('parses source blocks with groups in Gemfile', async () => {
    const sourceBlockWithGroupsGemfile = codeBlock`
      source 'https://hub.tech.my.domain.de/artifactory/api/gems/my-gems-prod-local/' do
        gem 'sfn_my_dep1', "~> 1"
        gem 'sfn_my_dep2', "~> 1"

        group :test, :development do
          gem 'internal_test_gem', "~> 1"
        end

        group :production do
          gem 'internal_production_gem', "~> 1"
        end
      end
    `;
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

  it('ignores a bare source variable that is not defined', async () => {
    const undefinedSourceGemfile = codeBlock`
      source undefined_var

      gem 'foo'
    `;

    fs.readLocalFile.mockResolvedValueOnce(undefinedSourceGemfile);
    const res = await extractPackageFile(undefinedSourceGemfile, 'Gemfile');
    expect(res).toMatchObject({
      registryUrls: [],
      deps: [{ depName: 'foo' }],
    });
  });

  it('ignores an inline gem source with no value', async () => {
    const emptyInlineSourceGemfile = codeBlock`
      gem 'foo', require: false, source:
    `;

    fs.readLocalFile.mockResolvedValueOnce(emptyInlineSourceGemfile);
    const res = await extractPackageFile(emptyInlineSourceGemfile, 'Gemfile');
    expect(res).toMatchObject({
      deps: [{ depName: 'foo' }],
    });
  });

  it('skips sourceUrl for a non-http git ref in Gemfile', async () => {
    const sshGitRefGemfile = codeBlock`
      gem 'foo', git: 'git@github.com:foo/foo.git', tag: 'v1.0.0'
    `;

    fs.readLocalFile.mockResolvedValueOnce(sshGitRefGemfile);
    const res = await extractPackageFile(sshGitRefGemfile, 'Gemfile');
    expect(res).toMatchObject({
      deps: [
        {
          depName: 'foo',
          packageName: 'git@github.com:foo/foo.git',
          currentValue: 'v1.0.0',
          datasource: 'git-refs',
        },
      ],
    });
    expect(res?.deps[0].sourceUrl).toBeUndefined();
  });

  it('parses a ruby version nested inside a group block', async () => {
    const rubyInGroupGemfile = codeBlock`
      group :test do
        ruby '2.7.1'
      end
    `;

    fs.readLocalFile.mockResolvedValueOnce(rubyInGroupGemfile);
    const res = await extractPackageFile(rubyInGroupGemfile, 'Gemfile');
    expect(res?.deps).toMatchObject([
      { depName: 'ruby', currentValue: '2.7.1' },
    ]);
    expect(res?.deps[0].managerData?.lineNumber).toBeNaN();
  });

  it('parses a ruby version nested inside a source block', async () => {
    const rubyInSourceBlockGemfile = codeBlock`
      source 'https://gems.example.com' do
        ruby '2.7.1'
      end
    `;

    fs.readLocalFile.mockResolvedValueOnce(rubyInSourceBlockGemfile);
    const res = await extractPackageFile(rubyInSourceBlockGemfile, 'Gemfile');
    expect(res?.deps).toMatchObject([
      { depName: 'ruby', currentValue: '2.7.1' },
    ]);
    expect(res?.deps[0].managerData?.lineNumber).toBeNaN();
  });

  it('parses a ruby version nested inside a platforms block', async () => {
    const rubyInPlatformsGemfile = codeBlock`
      platforms :jruby do
        ruby '2.7.1'
      end
    `;

    fs.readLocalFile.mockResolvedValueOnce(rubyInPlatformsGemfile);
    const res = await extractPackageFile(rubyInPlatformsGemfile, 'Gemfile');
    expect(res?.deps).toMatchObject([
      { depName: 'ruby', currentValue: '2.7.1' },
    ]);
    expect(res?.deps[0].managerData?.lineNumber).toBeNaN();
  });

  it('ignores an empty platforms block', async () => {
    const emptyPlatformsGemfile = codeBlock`
      gem 'foo'
      platforms :jruby do
      end
    `;

    fs.readLocalFile.mockResolvedValueOnce(emptyPlatformsGemfile);
    const res = await extractPackageFile(emptyPlatformsGemfile, 'Gemfile');
    expect(res?.deps).toMatchObject([{ depName: 'foo' }]);
  });

  it('parses a ruby version nested inside an if block', async () => {
    const rubyInIfGemfile = codeBlock`
      if RUBY_VERSION >= '3.0'
        ruby '2.7.1'
      end
    `;

    fs.readLocalFile.mockResolvedValueOnce(rubyInIfGemfile);
    const res = await extractPackageFile(rubyInIfGemfile, 'Gemfile');
    expect(res?.deps).toMatchObject([
      { depName: 'ruby', currentValue: '2.7.1' },
    ]);
    expect(res?.deps[0].managerData?.lineNumber).toBeNaN();
  });

  it('ignores an empty if block', async () => {
    const emptyIfGemfile = codeBlock`
      gem 'foo'
      if RUBY_VERSION >= '3.0'
      end
    `;

    fs.readLocalFile.mockResolvedValueOnce(emptyIfGemfile);
    const res = await extractPackageFile(emptyIfGemfile, 'Gemfile');
    expect(res?.deps).toMatchObject([{ depName: 'foo' }]);
  });
});
