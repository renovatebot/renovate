import { getPkgReleases } from '..';
import { Unity3dPackagesDatasource } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

describe('modules/datasource/unity3d-packages/index', () => {
  it(`package with no versions`, async () => {
    const data = `
      {
        "_id": "com.unity.xr.openxr",
        "name": "com.unity.xr.openxr",
        "description": "OpenXR is an open, royalty-free standard developed by Khronos that aims to simplify AR/VR development by allowing developers to target a wide range of AR/VR devices. Use this plug-in to enable OpenXR in XR Plug-in Management.",
        "provider": "upm",
        "versions": {},
        "time": {},
        "dist-tags": {
          "latest": "1.14.2"
        },
        "etag": "18855-eQZPc3Nb+IhUvhXerfZyyDG0KZc"
      }
    `;

    httpMock
      .scope('https://packages.unity.com')
      .get('/com.unity.xr.openxr')
      .reply(200, data);

    const res = await getPkgReleases({
      datasource: Unity3dPackagesDatasource.id,
      packageName: 'com.unity.xr.openxr',
      registryUrls: ['https://packages.unity.com'],
    });

    expect(res?.homepage).toBeUndefined();
    expect(res?.registryUrl).toBe('https://packages.unity.com');

    expect(res?.releases).toBeEmpty();
  });

  it(`package with no documentationUrl`, async () => {
    const data = `
      {
        "_id": "com.unity.xr.openxr",
        "name": "com.unity.xr.openxr",
        "description": "OpenXR is an open, royalty-free standard developed by Khronos that aims to simplify AR/VR development by allowing developers to target a wide range of AR/VR devices. Use this plug-in to enable OpenXR in XR Plug-in Management.",
        "provider": "upm",
        "versions": {
          "1.14.2": {
            "version": "1.14.2"
          }
        },
        "time": {
          "1.14.2": "2025-03-27T10:54:45.412Z"
        },
        "dist-tags": {
          "latest": "1.14.2"
        },
        "etag": "18855-eQZPc3Nb+IhUvhXerfZyyDG0KZc"
      }
    `;

    httpMock
      .scope('https://packages.unity.com')
      .get('/com.unity.xr.openxr')
      .reply(200, data);

    const res = await getPkgReleases({
      datasource: Unity3dPackagesDatasource.id,
      packageName: 'com.unity.xr.openxr',
      registryUrls: ['https://packages.unity.com'],
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
        "_id": "com.unity.xr.openxr",
        "name": "com.unity.xr.openxr",
        "description": "OpenXR is an open, royalty-free standard developed by Khronos that aims to simplify AR/VR development by allowing developers to target a wide range of AR/VR devices. Use this plug-in to enable OpenXR in XR Plug-in Management.",
        "provider": "upm",
        "versions": {
          "1.14.2": {
            "documentationUrl": "https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.14/manual/index.html",
            "version": "1.14.2"
          }
        },
        "time": {
          "1.14.2": "2025-03-27T10:54:45.412Z"
        },
        "dist-tags": {
          "latest": "1.14.2"
        },
        "etag": "18855-eQZPc3Nb+IhUvhXerfZyyDG0KZc"
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

  it(`package with real data`, async () => {
    httpMock
      .scope('https://packages.unity.com')
      .get('/com.unity.xr.openxr')
      .reply(200, Fixtures.get('package.json'));

    const res = await getPkgReleases({
      datasource: Unity3dPackagesDatasource.id,
      packageName: 'com.unity.xr.openxr',
      registryUrls: ['https://packages.unity.com'],
    });

    expect(res?.homepage).toBe(
      'https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.14/manual/index.html',
    );
    expect(res?.registryUrl).toBe('https://packages.unity.com');

    expect(res?.releases).toHaveLength(38);

    expect(res?.releases.find((r) => r.version === '1.14.2')).toEqual({
      changelogUrl:
        'https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.14/changelog/CHANGELOG.html',
      isStable: true,
      registryUrl: 'https://packages.unity.com',
      releaseTimestamp: '2025-03-27T10:54:45.412Z',
      version: '1.14.2',
    });

    expect(res?.releases.find((r) => r.version === '1.12.0-exp.1')).toEqual({
      changelogUrl:
        'https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.12/changelog/CHANGELOG.html',
      isStable: false,
      registryUrl: 'https://packages.unity.com',
      releaseTimestamp: '2024-07-03T15:24:28.000Z',
      version: '1.12.0-exp.1',
    });
  });
});
