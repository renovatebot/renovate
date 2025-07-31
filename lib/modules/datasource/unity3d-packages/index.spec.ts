import { getPkgReleases } from '..';
import { Unity3dPackagesDatasource } from '.';
import * as httpMock from '~test/http-mock';

describe('modules/datasource/unity3d-packages/index', () => {
  it(`package with no versions`, async () => {
    const data = `
      {
        "versions": {},
        "time": {}
      }
    `;

    httpMock
      .scope('https://packages.unity.com')
      .get('/com.unity.xr.openxr')
      .reply(200, data);

    const res = await getPkgReleases({
      datasource: Unity3dPackagesDatasource.id,
      packageName: 'com.unity.xr.openxr',
      registryUrls: [],
    });

    expect(res?.homepage).toBeUndefined();
    expect(res?.registryUrl).toBe('https://packages.unity.com');

    expect(res?.releases).toBeEmpty();
  });

  it(`package with no documentationUrl`, async () => {
    const data = `
      {
        "versions": {
          "1.14.2": {
            "version": "1.14.2"
          }
        },
        "time": {
          "1.14.2": "2025-03-27T10:54:45.412Z"
        }
      }
    `;

    httpMock
      .scope('https://packages.unity.com')
      .get('/com.unity.xr.openxr')
      .reply(200, data);

    const res = await getPkgReleases({
      datasource: Unity3dPackagesDatasource.id,
      packageName: 'com.unity.xr.openxr',
      registryUrls: [],
    });

    expect(res).toEqual({
      registryUrl: 'https://packages.unity.com',
      releases: [
        {
          changelogUrl: undefined,
          isStable: true,
          registryUrl: 'https://packages.unity.com',
          releaseTimestamp: '2025-03-27T10:54:45.412Z',
          version: '1.14.2',
        },
      ],
    });
  });

  it(`package from a custom registry`, async () => {
    const data = `
      {
        "versions": {
          "1.14.2": {
            "documentationUrl": "https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.14/manual/index.html",
            "version": "1.14.2"
          }
        },
        "time": {
          "1.14.2": "2025-03-27T10:54:45.412Z"
        }
      }
    `;

    httpMock
      .scope('https://custom.registry.com')
      .get('/com.unity.xr.openxr')
      .reply(200, data);

    const res = await getPkgReleases({
      datasource: Unity3dPackagesDatasource.id,
      packageName: 'com.unity.xr.openxr',
      registryUrls: ['https://custom.registry.com'],
    });

    expect(res).toEqual({
      homepage:
        'https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.14/manual/index.html',
      registryUrl: 'https://custom.registry.com',
      releases: [
        {
          changelogUrl: undefined,
          isStable: true,
          registryUrl: 'https://custom.registry.com',
          releaseTimestamp: '2025-03-27T10:54:45.412Z',
          version: '1.14.2',
        },
      ],
    });
  });

  it(`package with changelog content and url`, async () => {
    const data = `
      {
        "versions": {
          "1.14.3": {
            "_upm": {
              "changelog": "### Fixed\\n\\n* Fixed Multiview Render Regions feature regression."
            },
            "documentationUrl": "https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.14/manual/index.html",
            "version": "1.14.3"
          },
          "1.12.0-exp.1": {
            "_upm": {
            },
            "documentationUrl": "https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.12/manual/index.html",
            "version": "1.12.0-exp.1"
          },
          "1.0.0-pre.1": {
            "version": "1.0.0-pre.1"
          },
          "0.1.2-preview.2": {
            "version": "0.1.2-preview.2"
          }
        },
        "time": {
          "1.14.3": "2025-04-18T18:06:12.036Z",
          "1.12.0-exp.1": "2024-07-03T15:24:28.000Z",
          "1.0.0-pre.1": "2021-02-11T19:26:19.000Z",
          "0.1.2-preview.2": "2021-01-05T17:57:41.000Z"
        }
      }
    `;

    httpMock
      .scope('https://packages.unity.com')
      .get('/com.unity.xr.openxr')
      .reply(200, data);

    const res = await getPkgReleases({
      datasource: Unity3dPackagesDatasource.id,
      packageName: 'com.unity.xr.openxr',
      registryUrls: [],
    });

    expect(res).toStrictEqual({
      homepage:
        'https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.14/manual/index.html',
      registryUrl: 'https://packages.unity.com',
      releases: [
        {
          changelogContent: undefined,
          changelogUrl: undefined,
          isStable: false,
          registryUrl: 'https://packages.unity.com',
          releaseTimestamp: '2021-01-05T17:57:41.000Z',
          version: '0.1.2-preview.2',
        },
        {
          changelogContent: undefined,
          changelogUrl: undefined,
          isStable: false,
          registryUrl: 'https://packages.unity.com',
          releaseTimestamp: '2021-02-11T19:26:19.000Z',
          version: '1.0.0-pre.1',
        },
        {
          changelogContent: undefined,
          changelogUrl:
            'https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.12/changelog/CHANGELOG.html',
          isStable: false,
          registryUrl: 'https://packages.unity.com',
          releaseTimestamp: '2024-07-03T15:24:28.000Z',
          version: '1.12.0-exp.1',
        },
        {
          changelogContent:
            '### Fixed\n\n* Fixed Multiview Render Regions feature regression.',
          changelogUrl:
            'https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.14/changelog/CHANGELOG.html',
          isStable: true,
          registryUrl: 'https://packages.unity.com',
          releaseTimestamp: '2025-04-18T18:06:12.036Z',
          version: '1.14.3',
        },
      ],
    });
  });

  it(`package with repository`, async () => {
    const data = `
      {
        "versions": {
          "1.14.3": {
            "repository": {
              "url": "https://github.cds.internal.unity3d.com/unity/xr.sdk.openxr.git"
            },
            "version": "1.14.3"
          },
          "1.12.0-exp.1": {
            "version": "1.12.0-exp.1"
          }
        },
        "time": {
          "1.14.3": "2025-04-18T18:06:12.036Z",
          "1.12.0-exp.1": "2024-07-03T15:24:28.000Z"
        }
      }
    `;

    httpMock
      .scope('https://packages.unity.com')
      .get('/com.unity.xr.openxr')
      .reply(200, data);

    const res = await getPkgReleases({
      datasource: Unity3dPackagesDatasource.id,
      packageName: 'com.unity.xr.openxr',
      registryUrls: [],
    });

    expect(res).toStrictEqual({
      registryUrl: 'https://packages.unity.com',
      releases: [
        {
          changelogContent: undefined,
          changelogUrl: undefined,
          isStable: false,
          registryUrl: 'https://packages.unity.com',
          releaseTimestamp: '2024-07-03T15:24:28.000Z',
          version: '1.12.0-exp.1',
        },
        {
          changelogContent: undefined,
          changelogUrl: undefined,
          isStable: true,
          registryUrl: 'https://packages.unity.com',
          releaseTimestamp: '2025-04-18T18:06:12.036Z',
          version: '1.14.3',
        },
      ],
      sourceUrl:
        'https://github.cds.internal.unity3d.com/unity/xr.sdk.openxr.git',
    });
  });
});
