import { codeBlock } from 'common-tags';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { fetchUpdates } from '../../../workers/repository/process/fetch.ts';
import type { LookupUpdateConfig } from '../../../workers/repository/process/lookup/types.ts';
import type { PackageFile } from '../types.ts';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/gomod/integration', () => {
  let baseConfig: LookupUpdateConfig;

  beforeEach(() => {
    // TODO: fix types #22198
    baseConfig = partial<LookupUpdateConfig>(getConfig() as never);
    baseConfig.manager = 'gomod';
    baseConfig.constraintsFiltering = 'strict';
  });

  describe('when constraintsFiltering=strict', () => {
    it('only suggests updates within the minor version of the `go` directive', async () => {
      // make sure we can validate all suggested releases
      baseConfig.separateMultipleMinor = true;

      const goMod = codeBlock`
        module github.com/renovate-tests/gomod
        go 1.22.5

        require github.com/renovate-tests/some-module v0.1.0
      `;
      const extracted = extractPackageFile(goMod);
      expect(extracted).not.toBeNull();
      expect(extracted?.deps).toHaveLength(2);

      const dep = extracted!.deps.find(
        (d) => d.depName === 'github.com/renovate-tests/some-module',
      );
      expect(dep).toBeDefined();

      httpMock
        .scope('https://raw.githubusercontent.com')
        .get('/golang/website/HEAD/internal/history/release.go')
        .reply(200, '');
      httpMock
        .scope('https://proxy.golang.org')
        .get('/github.com/renovate-tests/some-module/@v/list')
        .reply(
          200,
          codeBlock`
            v0.2.0
            v0.3.0
            v0.4.0
            v0.5.0
            v0.6.0
        `,
        );

      const versions = {
        'v0.2.0': '1.18',
        'v0.3.0': '1.22.2',
        'v0.4.0': '1.22.5',
        'v0.5.0': '1.22.1000',
        'v0.6.0': '1.30.0',
      };
      for (const [k, v] of Object.entries(versions)) {
        httpMock
          .scope('https://proxy.golang.org')
          .get(`/github.com/renovate-tests/some-module/@v/${k}.info`)
          .reply(200, {
            Version: k,
          });
        httpMock
          .scope('https://proxy.golang.org')
          .get(`/github.com/renovate-tests/some-module/@v/${k}.mod`)
          .reply(
            200,
            codeBlock`module github.com/renovate-tests/some-module
               go ${v}
        `,
          );
      }

      httpMock
        .scope('https://proxy.golang.org')
        .get('/github.com/renovate-tests/some-module/v2/@v/list')
        .reply(404);

      httpMock
        .scope('https://proxy.golang.org')
        .get('/github.com/renovate-tests/some-module/@latest')
        .reply(200, 'v0.6.0');

      const packageFiles: Record<string, PackageFile[]> = {
        gomod: [
          partial({
            ...extracted,
            packageFile: 'go.mod',
          }),
        ],
      };

      await fetchUpdates(baseConfig, packageFiles);

      const updates = packageFiles.gomod[0].deps[1].updates;
      expect(updates).toEqual([
        {
          bucket: 'v0.3',
          hasAttestation: undefined,
          isBreaking: true,
          newMajor: 0,
          newMinor: 3,
          newPatch: 0,
          newValue: 'v0.3.0',
          newVersion: 'v0.3.0',
          updateType: 'minor',
        },
        {
          bucket: 'v0.4',
          hasAttestation: undefined,
          isBreaking: true,
          newMajor: 0,
          newMinor: 4,
          newPatch: 0,
          newValue: 'v0.4.0',
          newVersion: 'v0.4.0',
          updateType: 'minor',
        },
        {
          bucket: 'v0.5',
          hasAttestation: undefined,
          isBreaking: true,
          newMajor: 0,
          newMinor: 5,
          newPatch: 0,
          newValue: 'v0.5.0',
          newVersion: 'v0.5.0',
          updateType: 'minor',
        },
      ]);
    });
  });
});
