import { logger } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import type { ExtractConfig, PackageDependency } from '../types';
import { extractAllPackageFiles } from './extract';

const config: ExtractConfig = {};

const adminConfig: RepoGlobalConfig = { localDir: '' };

describe('manager/gitlabci/extract', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  describe('extractAllPackageFiles()', () => {
    it('returns null for empty', async () => {
      expect(
        await extractAllPackageFiles(config, [
          'lib/manager/gitlabci/__fixtures__/gitlab-ci.2.yaml',
        ])
      ).toBeNull();
    });

    it('extracts multiple included image lines', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/manager/gitlabci/__fixtures__/gitlab-ci.3.yaml',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);

      const deps: PackageDependency[] = [];
      res.forEach((e) => {
        e.deps.forEach((d) => {
          deps.push(d);
        });
      });
      expect(deps).toHaveLength(5);
    });

    it('extracts named services', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/manager/gitlabci/__fixtures__/gitlab-ci.5.yaml',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].deps).toHaveLength(3);
    });

    it('extracts multiple named services', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/manager/gitlabci/__fixtures__/gitlab-ci.6.yaml',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].deps).toHaveLength(3);
    });

    it('extracts multiple image lines', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/manager/gitlabci/__fixtures__/gitlab-ci.yaml',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);

      const deps: PackageDependency[] = [];
      res.forEach((e) => {
        e.deps.forEach((d) => {
          deps.push(d);
        });
      });
      expect(deps).toHaveLength(8);

      expect(deps.some((dep) => dep.currentValue.includes("'"))).toBeFalse();
    });

    it('extracts multiple image lines with comments', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/manager/gitlabci/__fixtures__/gitlab-ci.1.yaml',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);

      const deps: PackageDependency[] = [];
      res.forEach((e) => {
        e.deps.forEach((d) => {
          deps.push(d);
        });
      });
      expect(deps).toHaveLength(3);
    });

    it('catches errors', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/manager/gitlabci/__fixtures__/gitlab-ci.4.yaml',
      ]);
      expect(res).toBeNull();
      expect(logger.logger.warn).toHaveBeenCalled();
    });
  });
});
