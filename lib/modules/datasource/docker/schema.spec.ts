import {
  DistributionListManifest,
  DistributionManifest,
  HelmConfigBlob,
  Manifest,
  OciImageIndexManifest,
  OciImageManifest,
} from './schema';

describe('modules/datasource/docker/schema', () => {
  it('parses OCI image manifest', () => {
    const manifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.oci.image.config.v1+json',
        digest: 'sha256:1234567890abcdef',
        size: 12345,
      },
      layers: [
        {
          mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip',
          digest: 'sha256:1234567890abcdef',
          size: 12345,
        },
      ],
    };
    expect(OciImageManifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.oci.image.config.v1+json',
        digest: 'sha256:1234567890abcdef',
        size: 12345,
      },
    });

    expect(Manifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
    });

    delete (manifest as any).mediaType;

    expect(OciImageManifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.oci.image.config.v1+json',
        digest: 'sha256:1234567890abcdef',
        size: 12345,
      },
    });
  });

  it('parses OCI helm manifest', () => {
    const manifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.cncf.helm.config.v1+json',
        digest:
          'sha256:179618538d9f341897e5e05b2997f8c6f3009afe825525e87cf38a877fcb028e',
        size: 1066,
      },
      layers: [
        {
          mediaType: 'application/vnd.cncf.helm.chart.content.v1.tar+gzip',
          digest:
            'sha256:0dc5d782d04596548f91d54a412013d844baabede2daa7ec9e201e9c80daf533',
          size: 234103,
        },
      ],
    };
    expect(OciImageManifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.cncf.helm.config.v1+json',
        digest:
          'sha256:179618538d9f341897e5e05b2997f8c6f3009afe825525e87cf38a877fcb028e',
        size: 1066,
      },
    });

    expect(Manifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
    });

    delete (manifest as any).mediaType;

    expect(OciImageManifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.cncf.helm.config.v1+json',
        digest:
          'sha256:179618538d9f341897e5e05b2997f8c6f3009afe825525e87cf38a877fcb028e',
        size: 1066,
      },
    });
  });

  it('parses OCI image index', () => {
    const manifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.index.v1+json',
      manifests: [
        {
          mediaType: 'application/vnd.oci.image.manifest.v1+json',
          size: 7143,
          digest:
            'sha256:e692418e4cbaf90ca69d05a66403747baa33ee08806650b51fab815ad7fc331f',
          platform: {
            architecture: 'ppc64le',
            os: 'linux',
          },
        },
        {
          mediaType: 'application/vnd.oci.image.manifest.v1+json',
          size: 7682,
          digest:
            'sha256:5b0bcabd1ed22e9fb1310cf6c2dec7cdef19f0ad69efa1f392e94a4333501270',
          platform: {
            architecture: 'amd64',
            os: 'linux',
          },
        },
      ],
      annotations: {
        'com.example.key1': 'value1',
        'com.example.key2': 'value2',
      },
    };

    expect(OciImageIndexManifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.index.v1+json',
    });

    expect(Manifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.index.v1+json',
    });

    delete (manifest as any).mediaType;
    expect(OciImageIndexManifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.index.v1+json',
    });
  });

  it('parses distribution manifest', () => {
    const manifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
      config: {
        mediaType: 'application/vnd.docker.container.image.v1+json',
        digest:
          'sha256:b5b2b2c507a0944348e0303114d8d93aaaa081732b86451d9bce1f432a537bc7',
        size: 7023,
      },
      layers: [
        {
          mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
          digest:
            'sha256:e692418e4cbaf90ca69d05a66403747baa33ee08806650b51fab815ad7fc331f',
          size: 32654,
        },
        {
          mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
          digest:
            'sha256:3c3a4604a545cdc127456d94e421cd355bca5b528f4a9c1905b15da2eb4a4c6b',
          size: 16724,
        },
        {
          mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
          digest:
            'sha256:ec4b8955958665577945c89419d1af06b5f7636b4ac3da7f12184802ad867736',
          size: 73109,
        },
      ],
    };

    expect(DistributionManifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
    });

    expect(Manifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
    });
  });

  it('parses distribution manifest list', () => {
    const manifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.docker.distribution.manifest.list.v2+json',
      manifests: [
        {
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          digest:
            'sha256:e692418e4cbaf90ca69d05a66403747baa33ee08806650b51fab815ad7fc331f',
          size: 7143,
          platform: {
            architecture: 'ppc64le',
            os: 'linux',
          },
        },
        {
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          digest:
            'sha256:5b0bcabd1ed22e9fb1310cf6c2dec7cdef19f0ad69efa1f392e94a4333501270',
          size: 7682,
          platform: {
            architecture: 'amd64',
            os: 'linux',
            features: ['sse4'],
          },
        },
      ],
    };

    expect(DistributionListManifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.docker.distribution.manifest.list.v2+json',
    });

    expect(Manifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.docker.distribution.manifest.list.v2+json',
    });
  });

  it('parses OCI helm chart config', () => {
    const manifest = {
      annotations: {
        category: 'Infrastructure',
        licenses: 'Apache-2.0',
      },
      apiVersion: 'v2',
      appVersion: '2.8.2',
      dependencies: [
        {
          condition: 'redis.enabled',
          name: 'redis',
          repository: 'oci://registry-1.docker.io/bitnamicharts',
          version: '17.x.x',
        },
        {
          condition: 'postgresql.enabled',
          name: 'postgresql',
          repository: 'oci://registry-1.docker.io/bitnamicharts',
          version: '12.x.x',
        },
        {
          name: 'common',
          repository: 'oci://registry-1.docker.io/bitnamicharts',
          tags: ['bitnami-common'],
          version: '2.x.x',
        },
      ],
      home: 'https://bitnami.com',
      icon: 'https://bitnami.com/assets/stacks/harbor-core/img/harbor-core-stack-220x234.png',
      keywords: ['docker', 'registry', 'vulnerability', 'scan'],
      maintainers: [
        {
          name: 'VMware, Inc.',
          url: 'https://github.com/bitnami/charts',
        },
      ],
      name: 'harbor',
      sources: ['https://github.com/bitnami/charts/tree/main/bitnami/harbor'],
      version: '16.7.2',
    };

    expect(HelmConfigBlob.parse(manifest)).toMatchObject({
      sources: ['https://github.com/bitnami/charts/tree/main/bitnami/harbor'],
    });
  });
});
