import { logger } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { ExtractConfig, PackageDependency } from '../types';
import { extractAllPackageFiles } from './extract';

const config: ExtractConfig = {};

const adminConfig: RepoGlobalConfig = { localDir: '' };

describe('modules/manager/gitlabci/extract', () => {
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
          'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.2.yaml',
        ])
      ).toBeNull();
    });

    it('extracts multiple included image lines', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.3.yaml',
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
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.5.yaml',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].deps).toHaveLength(3);
    });

    it('extracts multiple named services', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.6.yaml',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].deps).toHaveLength(4);
    });

    it('extracts multiple image lines', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.yaml',
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
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.1.yaml',
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
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.4.yaml',
      ]);
      expect(res).toBeNull();
      expect(logger.logger.warn).toHaveBeenCalled();
    });

    it('skips images with variables', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.7.yaml',
      ]);
      expect(res).toEqual([
        {
          deps: [
            {
              autoReplaceStringTemplate:
                '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              datasource: 'docker',
              depType: 'image-name',
              replaceString: '$VARIABLE/renovate/renovate:31.65.1-slim',
              skipReason: 'contains-variable',
            },
            {
              autoReplaceStringTemplate:
                '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              datasource: 'docker',
              depType: 'service-image',
              replaceString: '$VARIABLE/other/image1:1.0.0',
              skipReason: 'contains-variable',
            },
            {
              autoReplaceStringTemplate:
                '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              datasource: 'docker',
              depType: 'service-image',
              replaceString: '${VARIABLE}/other/image1:2.0.0',
              skipReason: 'contains-variable',
            },
            {
              autoReplaceStringTemplate:
                '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              datasource: 'docker',
              depType: 'service-image',
              replaceString: 'docker.io/$VARIABLE/image1:3.0.0',
              skipReason: 'contains-variable',
            },
            {
              autoReplaceStringTemplate:
                '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              datasource: 'docker',
              depType: 'service-image',
              replaceString: 'docker.io/${VARIABLE}/image1:4.0.0',
              skipReason: 'contains-variable',
            },
          ],
          packageFile:
            'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.7.yaml',
        },
      ]);
    });

    it('extract images from dependency proxy', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.8.yaml',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
  });
});
