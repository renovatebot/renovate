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

    it('returns the translated registryURLs for arch aliases', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx
        archs:
          - amd64
          - arm64
        `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            skipReason: 'not-a-version',
          },
        ],
        lockFiles: undefined,
      });
    });

    it('returns null when the apko YAML file has no packages', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
        archs:
          - x86_64
          - aarch64
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
        archs:
            - x86_64
            - aarch64
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
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
        archs:
            - x86_64
            - aarch64
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
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
        archs:
            - x86_64
            - aarch64
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '20.10.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
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
        archs:
            - x86_64
            - aarch64
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'alpine-base',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            skipReason: 'not-a-version',
          },
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
          },
          {
            datasource: 'apk',
            depName: 'base',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            skipReason: 'not-a-version',
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '20.10.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
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
        archs:
            - x86_64
            - aarch64
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '1.24.0-r0',
            versioning: 'apk',
            managerData: { hasRevision: true },
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '20.10.0-r1',
            versioning: 'apk',
            managerData: { hasRevision: true },
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
        archs:
            - x86_64
            - aarch64
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            skipReason: 'not-a-version',
          },
          {
            datasource: 'apk',
            depName: 'python',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '3.11.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
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
          - x86_64
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
            ],
            currentValue: '20.10.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
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
        archs:
            - x86_64
            - aarch64
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'python-pip',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '23.0.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
          },
          {
            datasource: 'apk',
            depName: 'nodejs-npm',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '10.0.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
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
        archs:
            - x86_64
            - aarch64
      `;

      const lockFileContent = JSON.stringify({
        version: 'v1',
        config: {
          name: 'apko.yaml',
          checksum: 'sha256-gSjHFFSIirhjchHLAvMWZmCrcWCR3Bjq32O+uVZQNus=',
        },
        contents: {
          keyring: [],
          build_repositories: [],
          runtime_repositories: [],
          repositories: [
            {
              name: 'dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64/APKINDEX.tar.gz',
              architecture: 'x86_64',
            },
            {
              name: 'dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64/APKINDEX.tar.gz',
              architecture: 'aarch64',
            },
          ],
          packages: [
            {
              name: 'nginx',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64/nginx-1.24.0-r0.apk',
              version: '1.24.0-r0',
              architecture: 'x86_64',
              checksum: 'Q1+bndUK+WxWGwuQbMpatu8UAZO6c=',
            },
            {
              name: 'nodejs',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64/nodejs-20.10.0-r0.apk',
              version: '20.10.0-r0',
              architecture: 'x86_64',
              checksum: 'Q1NodeJS1234567890abcdef=',
            },
            {
              name: 'nginx',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64/nginx-1.24.0-r0.apk',
              version: '1.24.0-r0',
              architecture: 'aarch64',
              checksum: 'Q1NginxAarch641234567890=',
            },
            {
              name: 'nodejs',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64/nodejs-20.10.0-r0.apk',
              version: '20.10.0-r0',
              architecture: 'aarch64',
              checksum: 'Q1NodeJSAarch641234567890=',
            },
          ],
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
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
            lockedVersion: '1.24.0-r0',
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            currentValue: '20.10.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
            lockedVersion: '20.10.0-r0',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
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
        archs:
            - x86_64
            - aarch64
      `;

      vi.mocked(getSiblingFileName).mockReturnValue('apko.lock.json');
      vi.mocked(readLocalFile).mockResolvedValue('invalid json');

      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
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
        archs:
            - x86_64
            - aarch64
      `;

      vi.mocked(getSiblingFileName).mockReturnValue('apko.lock.json');
      vi.mocked(readLocalFile).mockResolvedValue('invalid json');

      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
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
        archs:
            - x86_64
            - aarch64
      `;

      const lockFileContent = JSON.stringify({
        version: 'v1',
        config: {
          name: 'image.yaml',
          checksum: 'sha256-gSjHFFSIirhjchHLAvMWZmCrcWCR3Bjq32O+uVZQNus=',
        },
        contents: {
          keyring: [],
          build_repositories: [],
          runtime_repositories: [],
          repositories: [
            {
              name: 'dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64/APKINDEX.tar.gz',
              architecture: 'x86_64',
            },
            {
              name: 'dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64/APKINDEX.tar.gz',
              architecture: 'aarch64',
            },
          ],
          packages: [
            {
              name: 'nginx',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64/nginx-1.24.0-r0.apk',
              version: '1.24.0-r0',
              architecture: 'x86_64',
              checksum: 'Q1+bndUK+WxWGwuQbMpatu8UAZO6c=',
            },
            {
              name: 'nodejs',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64/nodejs-20.10.0-r0.apk',
              version: '20.10.0-r0',
              architecture: 'x86_64',
              checksum: 'Q1NodeJS1234567890abcdef=',
            },
            {
              name: 'nginx',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64/nginx-1.24.0-r0.apk',
              version: '1.24.0-r0',
              architecture: 'aarch64',
              checksum: 'Q1NginxAarch641234567890=',
            },
            {
              name: 'nodejs',
              url: 'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64/nodejs-20.10.0-r0.apk',
              version: '20.10.0-r0',
              architecture: 'aarch64',
              checksum: 'Q1NodeJSAarch641234567890=',
            },
          ],
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
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
            lockedVersion: '1.24.0-r0',
          },
          {
            datasource: 'apk',
            depName: 'nodejs',
            currentValue: '20.10.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
            lockedVersion: '20.10.0-r0',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
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
        archs:
            - x86_64
            - aarch64
      `;
      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'wolfi-base',
            registryUrls: [
              'https://packages.wolfi.dev/os/x86_64',
              'https://packages.wolfi.dev/os/aarch64',
            ],
            skipReason: 'not-a-version',
          },
          {
            datasource: 'apk',
            depName: 'glibc',
            registryUrls: [
              'https://packages.wolfi.dev/os/x86_64',
              'https://packages.wolfi.dev/os/aarch64',
            ],
            currentValue: '2.36-r3',
            versioning: 'apk',
            managerData: { hasRevision: true },
          },
          {
            datasource: 'apk',
            depName: 'binutils',
            registryUrls: [
              'https://packages.wolfi.dev/os/x86_64',
              'https://packages.wolfi.dev/os/aarch64',
            ],
            currentValue: '2.39-r4',
            versioning: 'apk',
            managerData: { hasRevision: true },
          },
        ],
        lockFiles: undefined, // No lock file mocked, so will be undefined
      });
    });

    it('handles lock file parsing error and falls back to architecture-specific URLs', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
        archs:
          - x86_64
          - aarch64
      `;

      // Mock getSiblingFileName to return the lock file name
      vi.mocked(getSiblingFileName).mockReturnValueOnce('apko.lock.json');
      // Mock lock file content that will cause a parsing error
      vi.mocked(readLocalFile).mockResolvedValueOnce('invalid yaml content: [');

      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/aarch64',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
          },
        ],
        lockFiles: ['not here'],
      });
    });

    it('handles different architecture translations', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
        archs:
          - i386
          - arm/v6
          - arm/v7
      `;

      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'nginx',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/armhf',
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/armv7',
            ],
            currentValue: '1.24.0',
            versioning: 'apk',
            managerData: { hasRevision: false },
          },
        ],
        lockFiles: undefined,
      });
    });

    it('skips packages with range constraints', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - git>2.40
            - bash~5.2
            - curl<7.80
            - openssl=3.0.7-r0
        archs:
          - x86_64
      `;

      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'git',
            skipReason: 'unsupported-version',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
            ],
          },
          {
            datasource: 'apk',
            depName: 'bash',
            skipReason: 'unsupported-version',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
            ],
          },
          {
            datasource: 'apk',
            depName: 'curl',
            skipReason: 'unsupported-version',
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
            ],
          },
          {
            datasource: 'apk',
            depName: 'openssl',
            currentValue: '3.0.7-r0',
            versioning: 'apk',
            managerData: { hasRevision: true },
            registryUrls: [
              'https://dl-cdn.alpinelinux.org/alpine/edge/main/x86_64',
            ],
          },
        ],
        lockFiles: undefined,
      });
    });

    it('throws error when archs is not specified', async () => {
      const apkoYaml = codeBlock`
        contents:
          repositories:
            - https://dl-cdn.alpinelinux.org/alpine/edge/main
          packages:
            - nginx=1.24.0
      `;

      const result = await extractPackageFile(apkoYaml, 'apko.yaml');
      expect(result).toBeNull();
    });
  });
});
