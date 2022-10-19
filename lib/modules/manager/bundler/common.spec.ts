import { join } from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { fs, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { UpdateArtifact } from '../types';
import { getBundlerConstraint, getRubyConstraint } from './common';

jest.mock('../../../util/fs');

const gemfile = Fixtures.get('Gemfile.sourceGroup');
const lockedContent = Fixtures.get('Gemfile.gitlab-foss.lock');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
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

    it('extracts from lockfile', async () => {
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
      fs.readLocalFile.mockResolvedValueOnce('ruby-1.2.3');
      const version = await getRubyConstraint(config);
      expect(version).toBe('1.2.3');
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
});
