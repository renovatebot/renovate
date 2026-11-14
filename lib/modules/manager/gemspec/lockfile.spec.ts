import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { findGemspecLockFile } from './lockfile.ts';

vi.mock('../../../util/fs/index.ts');

function lockWithPath(remote: string, gemName: string): string {
  return codeBlock`
    PATH
      remote: ${remote}
      specs:
        ${gemName} (1.0.0)
          rack (~> 3.1)

    GEM
      remote: https://rubygems.org/
      specs:
        rack (3.1.8)

    PLATFORMS
      ruby

    DEPENDENCIES
      ${gemName}!
  `;
}

describe('modules/manager/gemspec/lockfile', () => {
  beforeEach(() => {
    fs.getSiblingFileName.mockImplementation(
      (_packageFile, otherFile) => `sub/${otherFile}`,
    );
  });

  it('returns null when there is no sibling Gemfile.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);

    const res = await findGemspecLockFile('sub/foo.gemspec', '');

    expect(res).toBeNull();
    expect(fs.readLocalFile).toHaveBeenCalledWith('sub/Gemfile.lock', 'utf8');
  });

  it.each`
    remote
    ${'.'}
    ${'./'}
  `(
    'returns the lock file when PATH `remote: $remote` lists the gem',
    async ({ remote }: { remote: string }) => {
      const lockFileContent = lockWithPath(remote, 'foo');
      fs.readLocalFile.mockResolvedValueOnce(lockFileContent);

      const res = await findGemspecLockFile('sub/foo.gemspec', '');

      expect(res).toEqual({ lockFile: 'sub/Gemfile.lock', lockFileContent });
    },
  );

  it('matches the literal spec.name over the file name', async () => {
    const lockFileContent = lockWithPath('.', 'foo-core');
    fs.readLocalFile.mockResolvedValueOnce(lockFileContent);
    const gemspec = codeBlock`
      Gem::Specification.new do |spec|
        spec.name = "foo-core"
      end
    `;

    const res = await findGemspecLockFile('sub/foo.gemspec', gemspec);

    expect(res).toEqual({ lockFile: 'sub/Gemfile.lock', lockFileContent });
  });

  it.each`
    case                                 | lockFileContent
    ${'has no PATH section'}             | ${'GEM\n  remote: https://rubygems.org/\n  specs:\n    foo (1.0.0)\n'}
    ${'locks the gem from another path'} | ${lockWithPath('engines/foo', 'foo')}
    ${'locks a different gem from .'}    | ${lockWithPath('.', 'bar')}
  `(
    'returns null when the lock file $case',
    async ({ lockFileContent }: { lockFileContent: string }) => {
      fs.readLocalFile.mockResolvedValueOnce(lockFileContent);

      const res = await findGemspecLockFile('sub/foo.gemspec', '');

      expect(res).toBeNull();
    },
  );

  it('checks every PATH section', async () => {
    const lockFileContent = codeBlock`
      PATH
        remote: engines/admin
        specs:
          admin (0.1.0)

      PATH
        remote: .
        specs:
          foo (1.0.0)
    `;
    fs.readLocalFile.mockResolvedValueOnce(lockFileContent);

    const res = await findGemspecLockFile('sub/foo.gemspec', '');

    expect(res).toEqual({ lockFile: 'sub/Gemfile.lock', lockFileContent });
  });

  it('ignores a spec name with the right name outside a PATH section', async () => {
    const lockFileContent = codeBlock`
      GIT
        remote: .
        specs:
          foo (1.0.0)
    `;
    fs.readLocalFile.mockResolvedValueOnce(lockFileContent);

    const res = await findGemspecLockFile('sub/foo.gemspec', '');

    expect(res).toBeNull();
  });
});
