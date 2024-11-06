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

const gitRefGemfile = codeBlock`
gem 'foo', git: 'https://github.com/foo/foo', ref: 'fd184883048b922b176939f851338d0a4971a532'
gem 'bar', git: 'https://github.com/bar/bar', tag: 'v1.0.0'
gem 'baz', github: 'baz/baz', branch: 'master'
`;

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
      source "https://rubygems.org"
      ruby '~> 1.5.3'
      foo = 'https://gems.foo.com'
      bar = 'https://gems.bar.com'

      source foo

      source bar do
        gem "some_internal_gem"
      end
    `;

    fs.readLocalFile.mockResolvedValueOnce(sourceVariableGemfile);
    const res = await extractPackageFile(sourceVariableGemfile, 'Gemfile');
    expect(res?.deps).toHaveLength(2);
    expect(res?.registryUrls).toHaveLength(2);
    expect(res?.registryUrls?.[1]).toBe('https://gems.foo.com');
    expect(res?.deps[1]).toMatchObject({
      depName: 'some_internal_gem',
      registryUrls: ['https://gems.bar.com'],
    });
  });

  it('parses git refs in Gemfile', async () => {
    fs.readLocalFile.mockResolvedValueOnce(gitRefGemfile);
    const res = await extractPackageFile(gitRefGemfile, 'Gemfile');
    expect(res?.deps).toHaveLength(3);
    expect(res?.deps).toMatchObject([
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
    ]);
  });
});
