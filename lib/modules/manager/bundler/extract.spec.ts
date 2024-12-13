import is from '@sindresorhus/is';
import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { isValid } from '../../versioning/ruby';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

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
      expect(res).toMatchSnapshot();
      // couple of dependency of ruby rails are not present in the lock file. Filter out those before processing
      expect(
        res?.deps
          .filter((dep) =>
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion'),
          )
          .every(
            (dep) => is.string(dep.lockedVersion) && isValid(dep.lockedVersion),
          ),
      ).toBeTrue();
      expect(res?.deps).toHaveLength(68);
    });

    it('parses sourceGroups', async () => {
      const res = await extractPackageFile(sourceGroupGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(7);
    });

    it('parse webpacker Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(webPackerGemfileLock);
      const res = await extractPackageFile(webPackerGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(
        res?.deps.every(
          (dep) => is.string(dep.lockedVersion) && isValid(dep.lockedVersion),
        ),
      ).toBeTrue();
      expect(res?.deps).toHaveLength(5);
    });

    it('parse mastodon Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(mastodonGemfileLock);
      const res = await extractPackageFile(mastodonGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(
        res?.deps
          .filter((dep) =>
            Object.prototype.hasOwnProperty.call(dep, 'lockedVersion'),
          )
          .every(
            (dep) => is.string(dep.lockedVersion) && isValid(dep.lockedVersion),
          ),
      ).toBeTrue();
      expect(res?.deps).toHaveLength(125);
    });

    it('parse Ruby CI Gemfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(rubyCIGemfileLock);
      const res = await extractPackageFile(rubyCIGemfile, 'Gemfile');
      expect(res).toMatchSnapshot();
      expect(
        res?.deps.every(
          (dep) => is.string(dep.lockedVersion) && isValid(dep.lockedVersion),
        ),
      ).toBeTrue();
      expect(res?.deps).toHaveLength(14);
    });
  });

  it('parse Gitlab Foss Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(gitlabFossGemfileLock);
    const res = await extractPackageFile(gitlabFossGemfile, 'Gemfile');
    expect(res).toMatchSnapshot();
    expect(
      res?.deps.every(
        (dep) => is.string(dep.lockedVersion) && isValid(dep.lockedVersion),
      ),
    ).toBeTrue();
    expect(res?.deps).toHaveLength(252);
  });

  it('parse source blocks in Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(sourceBlockGemfile);
    const res = await extractPackageFile(sourceBlockGemfile, 'Gemfile');
    expect(res).toMatchSnapshot();
  });

  it('parse source blocks with spaces in Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(sourceBlockWithNewLinesGemfileLock);
    const res = await extractPackageFile(
      sourceBlockWithNewLinesGemfile,
      'Gemfile',
    );
    expect(res).toMatchSnapshot();
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
