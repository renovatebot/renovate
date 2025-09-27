import { codeBlock } from 'common-tags';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { extractPackageFile } from './extract';

vi.mock('../../../util/fs');

describe('modules/manager/apko/extract', () => {
  describe('extractPackageFile', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns null when the apko YAML file is empty', async () => {
      const result = await extractPackageFile('', 'apko.yaml');
      expect(result).toBeNull();
    });

    it('returns null when the apko YAML file is malformed', async () => {
      const result = await extractPackageFile(
        'invalid: yaml: content',
        'apko.yaml',
      );
      expect(result).toBeNull();
    });

    it('returns null when the apko YAML file has no packages', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toBeNull();
    });

    it('returns a package dependency when the apko YAML file has a single versioned package', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '1.24.0',
            versioning: 'apk',
          },
        ],
        lockFiles: undefined, // No lock file mocked, so will be undefined
      });
    });

    it('returns a package dependency when the apko YAML file has a single package without version', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            skipReason: 'not-a-version',
          },
        ],
        lockFiles: undefined, // No lock file mocked, so will be undefined
      });
    });

    it('returns multiple package dependencies when the apko YAML file has multiple packages', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
            - nodejs=20.10.0
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '1.24.0',
            versioning: 'apk',
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '20.10.0',
            versioning: 'apk',
          },
        ],
        lockFiles: undefined, // No lock file mocked, so will be undefined
      });
    });

    it('skips base packages and extracts versioned packages', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - alpine-base
            - nginx=1.24.0
            - base
            - nodejs=20.10.0
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'alpine-base',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            skipReason: 'not-a-version',
          },
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '1.24.0',
            versioning: 'apk',
          },
          {
            datasource: 'apk',
            depName: 'base',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            skipReason: 'not-a-version',
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '20.10.0',
            versioning: 'apk',
          },
        ],
        lockFiles: undefined, // No lock file mocked, so will be undefined
      });
    });

    it('handles packages with complex version patterns', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0-r0
            - nodejs=20.10.0-r1
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '1.24.0-r0',
            versioning: 'apk',
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '20.10.0-r1',
            versioning: 'apk',
          },
        ],
        lockFiles: undefined, // No lock file mocked, so will be undefined
      });
    });

    it('handles mixed packages with and without versions', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
            - nodejs
            - python=3.11.0
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '1.24.0',
            versioning: 'apk',
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            skipReason: 'not-a-version',
          },
          {
            datasource: 'apk',
            depName: 'python',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '3.11.0',
            versioning: 'apk',
          },
        ],
        lockFiles: undefined, // No lock file mocked, so will be undefined
      });
    });

    it('handles full apko configuration with repositories and other fields', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
            - nodejs=20.10.0

        cmd: /bin/sh -l

        environment:
          PATH: /usr/local/sbin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin

        archs:
          - amd64
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '1.24.0',
            versioning: 'apk',
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '20.10.0',
            versioning: 'apk',
          },
        ],
        lockFiles: undefined, // No lock file mocked, so will be undefined
      });
    });

    it('handles packages with hyphens in names', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - python-pip=23.0.0
            - nodejs-npm=10.0.0
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'python-pip',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '23.0.0',
            versioning: 'apk',
          },
          {
            datasource: 'apk',
            depName: 'nodejs-npm',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '10.0.0',
            versioning: 'apk',
          },
        ],
        lockFiles: undefined, // No lock file mocked, so will be undefined
      });
    });

    it('extracts locked versions from apko.lock.json when available', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
            - nodejs=20.10.0
      `;

      const lockFileContent = JSON.stringify({
        schema_version: 1,
        archs: {
          amd64: {
            packages: [
              {
                name: 'nginx',
                version: '1.24.0-r0',
                origin: 'nginx',
                arch: 'x86_64',
                size: 67890,
                checksum: 'sha256:fedcba0987654321',
              },
              {
                name: 'nodejs',
                version: '20.10.0-r0',
                origin: 'nodejs',
                arch: 'x86_64',
                size: 54321,
                checksum: 'sha256:1234567890abcdef',
              },
            ],
          },
        },
      });

      vi.mocked(getSiblingFileName).mockReturnValue('apko.lock.json');
      vi.mocked(readLocalFile).mockResolvedValue(lockFileContent);

      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '1.24.0',
            versioning: 'apk',
            lockedVersion: '1.24.0-r0',
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            currentValue: '20.10.0',
            versioning: 'apk',
            lockedVersion: '20.10.0-r0',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
          },
        ],
        lockFiles: ['apko.lock.json'],
      });
    });

    it('handles malformed lock file gracefully', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
      `;

      vi.mocked(getSiblingFileName).mockReturnValue('apko.lock.json');
      vi.mocked(readLocalFile).mockResolvedValue('invalid json');

      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '1.24.0',
            versioning: 'apk',
          },
        ],
        lockFiles: ['apko.lock.json'],
      });
    });

    it('handles missing lock file gracefully', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
      `;

      vi.mocked(getSiblingFileName).mockReturnValue('apko.lock.json');
      // vi.mocked(readLocalFile).mockResolvedValue(null);
      vi.mocked(readLocalFile).mockResolvedValue('invalid json');

      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '1.24.0',
            versioning: 'apk',
          },
        ],
        lockFiles: ['apko.lock.json'],
      });
    });

    it('uses custom lockfile name based on package file name', async () => {
      const imageYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
            - nodejs=20.10.0
      `;

      const lockFileContent = JSON.stringify({
        schema_version: 1,
        archs: {
          amd64: {
            packages: [
              {
                name: 'nginx',
                version: '1.24.0-r0',
                origin: 'nginx',
                arch: 'x86_64',
                size: 67890,
                checksum: 'sha256:fedcba0987654321',
              },
              {
                name: 'nodejs',
                version: '20.10.0-r0',
                origin: 'nodejs',
                arch: 'x86_64',
                size: 54321,
                checksum: 'sha256:1234567890abcdef',
              },
            ],
          },
        },
      });

      vi.mocked(getSiblingFileName).mockReturnValue('image.lock.json');
      vi.mocked(readLocalFile).mockResolvedValue(lockFileContent);

      const result = await extractPackageFile(imageYaml, 'image.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
            currentValue: '1.24.0',
            versioning: 'apk',
            lockedVersion: '1.24.0-r0',
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            currentValue: '20.10.0',
            versioning: 'apk',
            lockedVersion: '20.10.0-r0',
            registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/edge/main'],
          },
        ],
        lockFiles: ['image.lock.json'],
      });

      // Verify that getSiblingFileName was called with the correct lockfile name
      expect(getSiblingFileName).toHaveBeenCalledWith(
        'image.yaml',
        'image.lock.json',
      );
    });

    it('handles different repository (Wolfi) with apkoYaml configuration', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://packages.wolfi.dev/os
          packages:
            - wolfi-base
            - glibc=2.36-r3
            - binutils=2.39-r4
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'wolfi-base',
            registryUrls: ['https://packages.wolfi.dev/os'],
            skipReason: 'not-a-version',
          },
          {
            datasource: 'apk',
            depName: 'glibc',
            registryUrls: ['https://packages.wolfi.dev/os'],
            currentValue: '2.36-r3',
            versioning: 'apk',
          },
          {
            datasource: 'apk',
            depName: 'binutils',
            registryUrls: ['https://packages.wolfi.dev/os'],
            currentValue: '2.39-r4',
            versioning: 'apk',
          },
        ],
        lockFiles: undefined, // No lock file mocked, so will be undefined
      });
    });
  });
});
