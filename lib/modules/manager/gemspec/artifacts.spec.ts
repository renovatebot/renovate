import { fs } from '~test/util.ts';
import * as _lock from '../bundler/lock.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../bundler/lock.ts');

const lock = vi.mocked(_lock);

const updateArtifact: UpdateArtifact = {
  packageFileName: 'sub/foo.gemspec',
  updatedDeps: [{ depName: 'rack' }],
  newPackageFileContent: 'gem.add_dependency "rack", "~> 3.1"',
  config: {},
};

describe('modules/manager/gemspec/artifacts', () => {
  beforeEach(() => {
    fs.getSiblingFileName.mockImplementation(
      (_packageFile, otherFile) => `sub/${otherFile}`,
    );
  });

  it('returns null when there is no sibling Gemfile.lock', async () => {
    fs.localPathExists.mockResolvedValue(false);

    await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    expect(fs.readLocalFile).not.toHaveBeenCalled();
    expect(lock.runBundlerLock).not.toHaveBeenCalled();
  });

  it('returns null when there is no sibling Gemfile', async () => {
    fs.localPathExists.mockResolvedValue(true);
    fs.readLocalFile.mockResolvedValue(null);

    await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    expect(lock.runBundlerLock).not.toHaveBeenCalled();
  });

  it('returns null when the Gemfile has no gemspec directive', async () => {
    fs.localPathExists.mockResolvedValue(true);
    fs.readLocalFile.mockResolvedValue(
      "source 'https://rubygems.org'\n# gemspec\ngem 'rack'\n",
    );

    await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    expect(lock.runBundlerLock).not.toHaveBeenCalled();
  });

  it.each`
    directive
    ${"gemspec name: 'bar'"}
    ${'gemspec :name => "bar"'}
    ${"gemspec path: 'other'"}
    ${"gemspec name: 'foo', path: '../foo'"}
  `(
    'returns null when `$directive` targets a different gemspec',
    async ({ directive }: { directive: string }) => {
      fs.localPathExists.mockResolvedValue(true);
      fs.readLocalFile.mockResolvedValue(
        `source 'https://rubygems.org'\n\n${directive}\n`,
      );

      const res = await updateArtifacts(updateArtifact);

      expect(res).toBeNull();
      expect(lock.runBundlerLock).not.toHaveBeenCalled();
    },
  );

  it.each`
    directive
    ${'gemspec'}
    ${"gemspec name: 'foo'"}
    ${'gemspec(:name => "foo", :path => ".")'}
    ${"gemspec path: './', development_group: :test"}
  `(
    'delegates to runBundlerLock when `$directive` targets the gemspec',
    async ({ directive }: { directive: string }) => {
      fs.localPathExists.mockResolvedValue(true);
      fs.readLocalFile.mockResolvedValue(
        `source 'https://rubygems.org'\n\n${directive}\n`,
      );
      lock.runBundlerLock.mockResolvedValue(null);

      await updateArtifacts(updateArtifact);

      expect(lock.runBundlerLock).toHaveBeenCalledWith(
        updateArtifact,
        'sub/Gemfile.lock',
      );
    },
  );

  it('delegates to runBundlerLock when the Gemfile uses the gemspec directive', async () => {
    fs.localPathExists.mockResolvedValue(true);
    fs.readLocalFile.mockResolvedValue(
      "source 'https://rubygems.org'\n\ngemspec name: 'foo'\n",
    );
    const result = [
      {
        file: {
          type: 'addition' as const,
          path: 'sub/Gemfile.lock',
          contents: 'x',
        },
      },
    ];
    lock.runBundlerLock.mockResolvedValue(result);

    await expect(updateArtifacts(updateArtifact)).resolves.toBe(result);
    expect(lock.runBundlerLock).toHaveBeenCalledWith(
      updateArtifact,
      'sub/Gemfile.lock',
    );
  });
});
