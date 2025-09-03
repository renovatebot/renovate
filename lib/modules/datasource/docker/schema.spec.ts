import { ZodError } from 'zod';
import {
  DistributionListManifest,
  DistributionManifest,
  Manifest,
  OciHelmConfig,
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

    expect(Manifest.parse(manifest)).toMatchObject({
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

    expect(Manifest.parse(manifest)).toMatchObject({
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
    expect(Manifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.index.v1+json',
    });
  });

  it('parses OCI image index and ignores unknown sub manifests', () => {
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
        {
          annotations: {
            'com.docker.official-images.bashbrew.arch': 'windows-amd64',
          },
          digest:
            'sha256:68b622deabed02180f6c985925143b02076942a3d5390e7bae36c037d646eee2',
          mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
          platform: {
            architecture: 'amd64',
            os: 'windows',
            'os.version': '10.0.17763.7314',
          },
          size: 3042,
        },
      ],
      annotations: {
        'com.example.key1': 'value1',
        'com.example.key2': 'value2',
      },
    };
    const parsedManifest = OciImageIndexManifest.parse(manifest);

    expect(parsedManifest).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.index.v1+json',
    });

    expect(parsedManifest.manifests).toHaveLength(2);
  });

  it('parses OCI flux artifact', () => {
    const manifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.cncf.flux.config.v1+json',
        digest:
          'sha256:7cd37ea18409c76d241ad0d4ed484e206275be3535782be144ae257d54dd8d50',
        size: 233,
      },
      layers: [
        {
          mediaType: 'application/vnd.cncf.flux.content.v1.tar+gzip',
          digest:
            'sha256:243a01363756cd6bc04243680d4c9aeac274523f298f9525823db9ae7e188a3c',
          size: 1113,
        },
      ],
      annotations: {
        'org.opencontainers.image.source':
          'https://github.com/renovatebot/renovate',
      },
    };
    expect(OciImageManifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.cncf.flux.config.v1+json',
        digest:
          'sha256:7cd37ea18409c76d241ad0d4ed484e206275be3535782be144ae257d54dd8d50',
        size: 233,
      },
      annotations: {
        'org.opencontainers.image.source':
          'https://github.com/renovatebot/renovate',
      },
    });

    expect(Manifest.parse(manifest)).toMatchObject({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.cncf.flux.config.v1+json',
        digest:
          'sha256:7cd37ea18409c76d241ad0d4ed484e206275be3535782be144ae257d54dd8d50',
        size: 233,
      },
      annotations: {
        'org.opencontainers.image.source':
          'https://github.com/renovatebot/renovate',
      },
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

    expect(OciHelmConfig.parse(manifest)).toMatchObject({
      sources: ['https://github.com/bitnami/charts/tree/main/bitnami/harbor'],
    });
  });

  it('parses devcontainer manifest', () => {
    const manifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.devcontainers',
        digest:
          'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        size: 0,
      },
      layers: [
        {
          mediaType: 'application/vnd.devcontainers.layer.v1+tar',
          digest:
            'sha256:d8b664ac545af10e7b241df64305d0ee7b544b826b7fe53bd7f35af114fdad97',
          size: 22528,
          annotations: {
            'org.opencontainers.image.title': 'devcontainer-feature-ruby.tgz',
          },
        },
      ],
      annotations: {
        'dev.containers.metadata':
          '{"id":"ruby","version":"1.2.1","name":"Ruby (via rvm)","documentationURL":"https://github.com/devcontainers/features/tree/main/src/ruby","description":"Installs Ruby, rvm, rbenv, common Ruby utilities, and needed dependencies.","options":{"version":{"type":"string","proposals":["latest","none","3.1","3.0","2.7"],"default":"latest","description":"Select or enter a Ruby version to install"}},"customizations":{"vscode":{"extensions":["shopify.ruby-lsp"]}},"containerEnv":{"GEM_PATH":"/usr/local/rvm/gems/default:/usr/local/rvm/gems/default@global","GEM_HOME":"/usr/local/rvm/gems/default","MY_RUBY_HOME":"/usr/local/rvm/rubies/default","PATH":"/usr/local/rvm/gems/default/bin:/usr/local/rvm/gems/default@global/bin:/usr/local/rvm/rubies/default/bin:/usr/local/share/rbenv/bin:${PATH}"},"installsAfter":["ghcr.io/devcontainers/features/common-utils"]}',
        'com.github.package.type': 'devcontainer_feature',
      },
    };

    expect(OciImageManifest.parse(manifest)).toMatchObject({
      config: {
        mediaType: 'application/vnd.devcontainers',
        digest:
          'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        size: 0,
      },
    });
  });

  it('throws for invalid manifest', () => {
    expect(() => Manifest.parse({ schemaVersion: 2 })).toThrow(ZodError);
  });
});
