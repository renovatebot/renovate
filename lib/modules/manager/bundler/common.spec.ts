import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { UpdateArtifact } from '../types';
import {
  getBundlerConstraint,
  getLockFilePath,
  getRubyConstraint,
} from './common';
import { Fixtures } from '~test/fixtures';
import { fs, partial } from '~test/util';

vi.mock('../../../util/fs');

const gemfile = Fixtures.get('Gemfile.sourceGroup');
const lockedContent = Fixtures.get('Gemfile.gitlab-foss.lock');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

describe('modules/manager/bundler/common', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  describe('getBundlerConstraint', () => {
    it('uses existing constraint', () => {
      const config: Pick<UpdateArtifact, 'config'> = {
        config: {
          constraints: { bundler: '2.1.0' },
        },
      };
      const version = getBundlerConstraint(config, lockedContent);
      expect(version).toBe('2.1.0');
    });

    it('extracts from lockfile', () => {
      const config: Pick<UpdateArtifact, 'config'> = {
        config: {},
      };
      const version = getBundlerConstraint(config, lockedContent);
      expect(version).toBe('1.17.3');
    });

    it('returns null', () => {
      const config: Pick<UpdateArtifact, 'config'> = {
        config: {},
      };
      const version = getBundlerConstraint(config, '');
      expect(version).toBeNull();
    });
  });

  describe('getRubyConstraint', () => {
    it('uses existing constraint', async () => {
      const config = partial<UpdateArtifact>({
        packageFileName: 'Gemfile',
        newPackageFileContent: gemfile,
        config: {
          constraints: { ruby: '2.1.0' },
        },
      });
      const version = await getRubyConstraint(config);
      expect(version).toBe('2.1.0');
    });

    it('extracts from gemfile', async () => {
      const config = partial<UpdateArtifact>({
        packageFileName: 'Gemfile',
        newPackageFileContent: gemfile,
        config: {},
      });
      const version = await getRubyConstraint(config);
      expect(version).toBe('~> 1.5.3');
    });

    it('extracts from .ruby-version', async () => {
      const config = partial<UpdateArtifact>({
        packageFileName: 'Gemfile',
        newPackageFileContent: '',
        config: {},
      });
      fs.readLocalFile.mockResolvedValueOnce('2.7.8');
      const version = await getRubyConstraint(config);
      expect(version).toBe('2.7.8');
    });

    it('extracts from .tool-versions', async () => {
      const config = partial<UpdateArtifact>({
        packageFileName: 'Gemfile',
        newPackageFileContent: '',
        config: {},
      });
      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('python\t3.8.10\nruby\t3.3.4\n');
      const version = await getRubyConstraint(config);
      expect(version).toBe('3.3.4');
    });

    it('extracts from lockfile', async () => {
      const config = partial<UpdateArtifact>({
        packageFileName: 'Gemfile',
        newPackageFileContent: '',
        config: {},
      });
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(Fixtures.get('Gemfile.rubyci.lock'));
      const version = await getRubyConstraint(config);
      expect(version).toBe('2.6.5');
    });

    it('returns null', async () => {
      const config = partial<UpdateArtifact>({
        packageFileName: 'Gemfile',
        newPackageFileContent: '',
        config: {},
      });
      const version = await getRubyConstraint(config);
      expect(version).toBeNull();
    });
  });

  describe('getLockFileName', () => {
    it('returns packageFileName.lock', async () => {
      fs.localPathExists.mockResolvedValueOnce(true);
      const lockFileName = await getLockFilePath('packageFileName');
      expect(lockFileName).toBe('packageFileName.lock');
    });

    it('returns Gemfile.lock', async () => {
      fs.localPathExists.mockResolvedValueOnce(false);
      const lockFileName = await getLockFilePath('packageFileName');
      expect(lockFileName).toBe('Gemfile.lock');
    });
  });
});
