import { codeBlock } from 'common-tags';
import { toBase64 } from '../../../util/string';
import { getPkgReleases } from '../index';
import { BitriseDatasource } from './index';
import * as httpMock from '~test/http-mock';

describe('modules/datasource/bitrise/index', () => {
  describe('getReleases()', () => {
    it('returns null for unsupported registryUrl', async () => {
      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'script',
          registryUrls: ['https://gitlab.com/bitrise-io/bitrise-steplib'],
        }),
      ).resolves.toBeNull();
    });

    it('support GitHub Enterprise API URL', async () => {
      httpMock
        .scope(
          'https://github.mycompany.com/api/v3/repos/foo/bar/contents/steps',
        )
        .get('/script')
        .reply(200, [
          {
            type: 'dir',
            name: '1.0.0',
            path: 'steps/script/1.0.0',
          },
        ])
        .get('/script/1.0.0/step.yml')
        .reply(200, {
          type: 'file',
          name: 'step.yml',
          path: 'steps/script/1.0.0/step.yml',
          encoding: 'base64',
          content: toBase64(codeBlock`
          published_at: 2024-03-19T13:54:48.081077+01:00
          source_code_url: https://github.com/bitrise-steplib/bitrise-step-script
          website: https://github.com/bitrise-steplib/bitrise-step-script
        `),
        });
      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'script',
          registryUrls: ['https://github.mycompany.com/foo/bar'],
        }),
      ).resolves.toEqual({
        homepage: 'https://bitrise.io/integrations/steps/script',
        registryUrl: 'https://github.mycompany.com/foo/bar',
        releases: [
          {
            releaseTimestamp: '2024-03-19T12:54:48.081Z',
            sourceUrl: 'https://github.com/bitrise-steplib/bitrise-step-script',
            version: '1.0.0',
          },
        ],
      });
    });

    it('returns version and filters out the asset folder', async () => {
      httpMock
        .scope(
          'https://api.github.com/repos/bitrise-io/bitrise-steplib/contents/steps',
        )
        .get('/activate-build-cache-for-bazel')
        .reply(200, [
          {
            type: 'dir',
            name: '1.0.0',
            path: 'steps/activate-build-cache-for-bazel/1.0.0',
          },
          {
            type: 'dir',
            name: '1.0.1',
            path: 'steps/activate-build-cache-for-bazel/1.0.1',
          },
          {
            type: 'dir',
            name: 'assets',
            path: 'steps/activate-build-cache-for-bazel/assets',
          },
        ])
        .get('/activate-build-cache-for-bazel/1.0.0/step.yml')
        .reply(200, {
          type: 'file',
          name: 'step.yml',
          path: 'steps/activate-build-cache-for-bazel/1.0.0/step.yml',
          encoding: 'base64',
          content: toBase64(codeBlock`
          published_at: 2024-03-19T13:54:48.081077+01:00
          source_code_url: https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel
          website: https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel
        `),
        })
        .get('/activate-build-cache-for-bazel/1.0.1/step.yml')
        .reply(200, {
          type: 'file',
          name: 'step.yml',
          path: 'steps/activate-build-cache-for-bazel/1.0.1/step.yml',
          encoding: 'base64',
          content: toBase64(codeBlock`
          published_at: "2024-07-03T08:53:25.668504731Z"
          source_code_url: https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel
          website: https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel
        `),
        });

      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'activate-build-cache-for-bazel',
        }),
      ).resolves.toEqual({
        homepage:
          'https://bitrise.io/integrations/steps/activate-build-cache-for-bazel',
        registryUrl: 'https://github.com/bitrise-io/bitrise-steplib.git',
        releases: [
          {
            releaseTimestamp: '2024-03-19T12:54:48.081Z',
            sourceUrl:
              'https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel',
            version: '1.0.0',
          },
          {
            releaseTimestamp: '2024-07-03T08:53:25.668Z',
            sourceUrl:
              'https://github.com/bitrise-steplib/bitrise-step-activate-build-cache-for-bazel',
            version: '1.0.1',
          },
        ],
      });
    });

    it('returns null if there are no releases', async () => {
      httpMock
        .scope(
          'https://api.github.com/repos/bitrise-io/bitrise-steplib/contents/steps',
        )
        .get('/activate-build-cache-for-bazel')
        .reply(200, [
          {
            type: 'dir',
            name: 'assets',
            path: 'steps/activate-build-cache-for-bazel/assets',
          },
        ]);

      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'activate-build-cache-for-bazel',
        }),
      ).resolves.toBeNull();
    });

    it('returns null if the package has an unexpected format', async () => {
      httpMock
        .scope(
          'https://api.github.com/repos/bitrise-io/bitrise-steplib/contents/steps',
        )
        .get('/activate-build-cache-for-bazel')
        .reply(200, {
          type: 'file',
          name: 'assets',
          path: 'steps/activate-build-cache-for-bazel/assets',
        });

      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'activate-build-cache-for-bazel',
        }),
      ).resolves.toBeNull();
    });

    it('returns null if the file object has no content', async () => {
      httpMock
        .scope(
          'https://api.github.com/repos/bitrise-io/bitrise-steplib/contents/steps',
        )
        .get('/script')
        .reply(200, [
          {
            type: 'dir',
            name: '1.0.0',
            path: 'steps/script/1.0.0',
          },
        ])
        .get('/script/1.0.0/step.yml')
        .reply(200, {
          type: 'file',
          name: 'step.yml',
          path: 'steps/script/1.0.0/step.yml',
        });
      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'script',
        }),
      ).resolves.toBeNull();
    });

    it('returns null if the file object has an unexpected encoding', async () => {
      httpMock
        .scope(
          'https://api.github.com/repos/bitrise-io/bitrise-steplib/contents/steps',
        )
        .get('/script')
        .reply(200, [
          {
            type: 'dir',
            name: '1.0.0',
            path: 'steps/script/1.0.0',
          },
        ])
        .get('/script/1.0.0/step.yml')
        .reply(200, {
          type: 'file',
          name: 'step.yml',
          path: 'steps/script/1.0.0/step.yml',
          encoding: 'none',
          content: '',
        });
      await expect(
        getPkgReleases({
          datasource: BitriseDatasource.id,
          packageName: 'script',
        }),
      ).resolves.toBeNull();
    });
  });
});
