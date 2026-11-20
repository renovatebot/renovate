import { codeBlock } from 'common-tags';
import { fs, logger } from '~test/util.ts';
import { BufModuleDatasource } from '../../datasource/buf-module/index.ts';
import { BufPluginDatasource } from '../../datasource/buf-plugin/index.ts';
import { extractAllPackageFiles, extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/buf/extract', () => {
  describe('extractPackageFile() - buf.gen.yaml', () => {
    it('returns null for malformed yaml', () => {
      expect(extractPackageFile('}}}not yaml', 'buf.gen.yaml', {})).toBeNull();
    });

    it('returns null when there are no plugins', () => {
      const content = `
        version: v2
      `;
      expect(extractPackageFile(content, 'buf.gen.yaml', {})).toBeNull();
    });

    it('extracts a v1 remote plugin reference', () => {
      const content = `
        version: v1
        plugins:
          - plugin: buf.build/protocolbuffers/go:v1.28.0
            out: gen/go
      `;
      const res = extractPackageFile(content, 'buf.gen.yaml', {});
      expect(res?.deps).toEqual([
        {
          depName: 'protocolbuffers/go',
          datasource: BufPluginDatasource.id,
          registryUrls: ['https://buf.build'],
          currentValue: 'v1.28.0',
          replaceString: 'buf.build/protocolbuffers/go:v1.28.0',
          autoReplaceStringTemplate:
            'buf.build/protocolbuffers/go:{{#if newValue}}{{newValue}}{{/if}}',
        },
      ]);
    });

    it('leaves the v1 revision field untouched', () => {
      const content = `
        version: v1
        plugins:
          - plugin: buf.build/protocolbuffers/go:v1.28.0
            revision: 1
            out: gen/go
      `;
      const res = extractPackageFile(content, 'buf.gen.yaml', {});
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].currentValue).toBe('v1.28.0');
    });

    it('extracts a v2 remote plugin reference', () => {
      const content = `
        plugins:
          - remote: buf.build/bufbuild/connect-go:v1.10.0
            out: gen/go
      `;
      const res = extractPackageFile(content, 'buf.gen.yaml', {});
      expect(res?.deps).toEqual([
        {
          depName: 'bufbuild/connect-go',
          datasource: BufPluginDatasource.id,
          registryUrls: ['https://buf.build'],
          currentValue: 'v1.10.0',
          replaceString: 'buf.build/bufbuild/connect-go:v1.10.0',
          autoReplaceStringTemplate:
            'buf.build/bufbuild/connect-go:{{#if newValue}}{{newValue}}{{/if}}',
        },
      ]);
    });

    it('extracts a self-hosted BSR host', () => {
      const content = `
        plugins:
          - remote: bsr.example.com/owner/name:v0.1.0
      `;
      const res = extractPackageFile(content, 'buf.gen.yaml', {});
      expect(res?.deps).toEqual([
        {
          depName: 'owner/name',
          datasource: BufPluginDatasource.id,
          registryUrls: ['https://bsr.example.com'],
          currentValue: 'v0.1.0',
          replaceString: 'bsr.example.com/owner/name:v0.1.0',
          autoReplaceStringTemplate:
            'bsr.example.com/owner/name:{{#if newValue}}{{newValue}}{{/if}}',
        },
      ]);
    });

    it('skips a v1 local plugin', () => {
      const content = `
        version: v1
        plugins:
          - plugin: go
            out: gen/go
      `;
      expect(extractPackageFile(content, 'buf.gen.yaml', {})).toBeNull();
    });

    it('skips v2 local and protoc_builtin plugins', () => {
      const content = `
        plugins:
          - local: protoc-gen-go
            out: gen/go
          - protoc_builtin: cpp
            out: gen/cpp
      `;
      expect(extractPackageFile(content, 'buf.gen.yaml', {})).toBeNull();
    });

    it('flags a remote plugin with no pinned version', () => {
      const content = `
        plugins:
          - remote: buf.build/bufbuild/connect-go
            out: gen/go
      `;
      const res = extractPackageFile(content, 'buf.gen.yaml', {});
      expect(res?.deps).toEqual([
        {
          depName: 'bufbuild/connect-go',
          datasource: BufPluginDatasource.id,
          registryUrls: ['https://buf.build'],
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('flags a remote plugin pinned only by revision', () => {
      const content = `
        plugins:
          - remote: buf.build/bufbuild/connect-go
            revision: 2
            out: gen/go
      `;
      const res = extractPackageFile(content, 'buf.gen.yaml', {});
      expect(res?.deps).toEqual([
        {
          depName: 'bufbuild/connect-go',
          datasource: BufPluginDatasource.id,
          registryUrls: ['https://buf.build'],
          skipReason: 'unspecified-version',
        },
      ]);
    });
  });

  describe('extractPackageFile() - buf.lock', () => {
    it('returns null for malformed yaml', () => {
      expect(extractPackageFile('}}}not yaml', 'buf.lock', {})).toBeNull();
    });

    it('returns null when there are no deps', () => {
      expect(extractPackageFile('version: v2', 'buf.lock', {})).toBeNull();
    });

    it('extracts v2 module deps pinned to their commit', () => {
      const content = codeBlock`
        version: v2
        deps:
          - name: buf.build/googleapis/googleapis
            commit: 62f35d8aed1149c291d606d958a7ce32
            digest: b5:abc
          - name: bsr.example.com/acme/weather
            commit: 0000000000000000000000000000dead
            digest: b5:def
      `;
      const res = extractPackageFile(content, 'buf.lock', {});
      expect(res?.deps).toEqual([
        {
          depName: 'googleapis/googleapis',
          datasource: BufModuleDatasource.id,
          registryUrls: ['https://buf.build'],
          currentDigest: '62f35d8aed1149c291d606d958a7ce32',
        },
        {
          depName: 'acme/weather',
          datasource: BufModuleDatasource.id,
          registryUrls: ['https://bsr.example.com'],
          currentDigest: '0000000000000000000000000000dead',
        },
      ]);
    });

    it('extracts v1 module deps (remote/owner/repository)', () => {
      const content = codeBlock`
        version: v1
        deps:
          - remote: buf.build
            owner: googleapis
            repository: googleapis
            commit: 62f35d8aed1149c291d606d958a7ce32
            digest: shake256:abc
      `;
      const res = extractPackageFile(content, 'buf.lock', {});
      expect(res?.deps).toEqual([
        {
          depName: 'googleapis/googleapis',
          datasource: BufModuleDatasource.id,
          registryUrls: ['https://buf.build'],
          currentDigest: '62f35d8aed1149c291d606d958a7ce32',
        },
      ]);
    });

    it('skips entries missing a commit or module identity', () => {
      const content = codeBlock`
        version: v2
        deps:
          - name: buf.build/googleapis/googleapis
            digest: b5:nocommit
          - commit: 0000000000000000000000000000dead
          - name: buf.build/valid/module
            commit: 1111111111111111111111111111beef
            digest: b5:ok
      `;
      const res = extractPackageFile(content, 'buf.lock', {});
      expect(res?.deps).toEqual([
        {
          depName: 'valid/module',
          datasource: BufModuleDatasource.id,
          registryUrls: ['https://buf.build'],
          currentDigest: '1111111111111111111111111111beef',
        },
      ]);
    });

    it('skips and logs a committed dep whose name is not host/owner/repository', () => {
      // The schema types `name` as an arbitrary string, so a reference missing
      // a segment passes validation and the commit guard, then trips the
      // host/owner/repository split.
      const content = codeBlock`
        version: v2
        deps:
          - name: buf.build/incomplete
            commit: 2222222222222222222222222222cafe
            digest: b5:bad
          - name: buf.build/valid/module
            commit: 1111111111111111111111111111beef
            digest: b5:ok
      `;
      const res = extractPackageFile(content, 'buf.lock', {});
      expect(res?.deps).toEqual([
        {
          depName: 'valid/module',
          datasource: BufModuleDatasource.id,
          registryUrls: ['https://buf.build'],
          currentDigest: '1111111111111111111111111111beef',
        },
      ]);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { packageFile: 'buf.lock', module: 'buf.build/incomplete' },
        'buf: skipping buf.lock dep with unparseable module name',
      );
    });
  });

  describe('extractAllPackageFiles()', () => {
    // buf.lock records the full transitive closure; buf.yaml lists only the
    // direct deps (optionally with a `:reference`). googleapis (no ref),
    // acme/labeled (label ref) and acme/tagged (version-like ref) are direct;
    // grpc/grpc is transitive.
    const bufLock = codeBlock`
      version: v2
      deps:
        - name: buf.build/googleapis/googleapis
          commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
          digest: b5:1
        - name: buf.build/acme/labeled
          commit: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
          digest: b5:2
        - name: buf.build/acme/tagged
          commit: cccccccccccccccccccccccccccccccc
          digest: b5:3
        - name: buf.build/grpc/grpc
          commit: dddddddddddddddddddddddddddddddd
          digest: b5:4
    `;
    const bufYaml = codeBlock`
      version: v2
      deps:
        - buf.build/googleapis/googleapis
        - buf.build/acme/labeled:staging
        - buf.build/acme/tagged:v1.2.3
    `;

    beforeEach(() => {
      fs.getSiblingFileName.mockReturnValue('buf.yaml');
    });

    function mockFiles(files: Record<string, string | null>): void {
      fs.readLocalFile.mockImplementation((file): Promise<any> => {
        return Promise.resolve(file in files ? files[file] : null);
      });
    }

    it('filters transitive deps and recovers direct-dep references', async () => {
      mockFiles({ 'buf.lock': bufLock, 'buf.yaml': bufYaml });
      fs.localPathIsFile.mockResolvedValue(true);

      const res = await extractAllPackageFiles({}, ['buf.lock']);

      expect(res).toEqual([
        {
          packageFile: 'buf.lock',
          deps: [
            {
              // direct, no reference -> tracks the default `main` label
              depName: 'googleapis/googleapis',
              datasource: BufModuleDatasource.id,
              registryUrls: ['https://buf.build'],
              currentDigest: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
            {
              // direct, label reference -> recovered as currentValue
              depName: 'acme/labeled',
              datasource: BufModuleDatasource.id,
              registryUrls: ['https://buf.build'],
              currentDigest: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              currentValue: 'staging',
            },
            {
              // direct, version-like reference -> unsupported (datasource has
              // no tags), skipped rather than silently tracking `main`
              depName: 'acme/tagged',
              datasource: BufModuleDatasource.id,
              registryUrls: ['https://buf.build'],
              currentDigest: 'cccccccccccccccccccccccccccccccc',
              skipReason: 'unsupported-version',
            },
            {
              // transitive -> not independently updatable
              depName: 'grpc/grpc',
              datasource: BufModuleDatasource.id,
              registryUrls: ['https://buf.build'],
              currentDigest: 'dddddddddddddddddddddddddddddddd',
              skipReason: 'inherited-dependency',
            },
          ],
        },
      ]);
    });

    it('tracks `main` for a commit-pinned direct dep so the sha can advance', async () => {
      // A `buf.yaml` dep pinned to a specific commit (the normal state right
      // after `buf dep update`) must NOT recover that commit as currentValue:
      // getDigest would resolve the commit to itself and never bump.
      const lock = codeBlock`
        version: v2
        deps:
          - name: buf.build/protocolbuffers/wellknowntypes
            commit: ba48c1a6dc7d47d0aa9940aa3601b039
            digest: b5:1
      `;
      const yaml = codeBlock`
        version: v2
        deps:
          - buf.build/protocolbuffers/wellknowntypes:ba48c1a6dc7d47d0aa9940aa3601b039
      `;
      mockFiles({ 'buf.lock': lock, 'buf.yaml': yaml });
      fs.localPathIsFile.mockResolvedValue(true);

      const res = await extractAllPackageFiles({}, ['buf.lock']);

      expect(res).toEqual([
        {
          packageFile: 'buf.lock',
          deps: [
            {
              // no currentValue and no skipReason -> tracks the default `main`
              depName: 'protocolbuffers/wellknowntypes',
              datasource: BufModuleDatasource.id,
              registryUrls: ['https://buf.build'],
              currentDigest: 'ba48c1a6dc7d47d0aa9940aa3601b039',
            },
          ],
        },
      ]);
    });

    // With no usable buf.yaml, deps are neither filtered nor reference-enriched.
    const allUpdatable = [undefined, undefined, undefined, undefined];

    it('leaves all deps updatable when there is no sibling buf.yaml', async () => {
      mockFiles({ 'buf.lock': bufLock });
      fs.localPathIsFile.mockResolvedValue(false);

      const res = await extractAllPackageFiles({}, ['buf.lock']);

      expect(res[0].deps.map((dep) => dep.skipReason)).toEqual(allUpdatable);
      expect(res[0].deps.map((dep) => dep.currentValue)).toEqual(allUpdatable);
    });

    it('leaves all deps updatable when buf.yaml is unreadable', async () => {
      mockFiles({ 'buf.lock': bufLock, 'buf.yaml': null });
      fs.localPathIsFile.mockResolvedValue(true);

      const res = await extractAllPackageFiles({}, ['buf.lock']);

      expect(res[0].deps.map((dep) => dep.skipReason)).toEqual(allUpdatable);
    });

    it('leaves all deps updatable when buf.yaml is unparseable', async () => {
      mockFiles({ 'buf.lock': bufLock, 'buf.yaml': '}}}not yaml' });
      fs.localPathIsFile.mockResolvedValue(true);

      const res = await extractAllPackageFiles({}, ['buf.lock']);

      expect(res[0].deps.map((dep) => dep.skipReason)).toEqual(allUpdatable);
    });

    it('extracts buf.gen.yaml plugins without a sibling lookup', async () => {
      const genYaml = codeBlock`
        version: v2
        plugins:
          - remote: buf.build/protocolbuffers/go:v1.28.0
      `;
      mockFiles({ 'buf.gen.yaml': genYaml });

      const res = await extractAllPackageFiles({}, ['buf.gen.yaml']);

      expect(res).toEqual([
        {
          packageFile: 'buf.gen.yaml',
          deps: [
            {
              depName: 'protocolbuffers/go',
              datasource: BufPluginDatasource.id,
              registryUrls: ['https://buf.build'],
              currentValue: 'v1.28.0',
              replaceString: 'buf.build/protocolbuffers/go:v1.28.0',
              autoReplaceStringTemplate:
                'buf.build/protocolbuffers/go:{{#if newValue}}{{newValue}}{{/if}}',
            },
          ],
        },
      ]);
      expect(fs.localPathIsFile).not.toHaveBeenCalled();
    });

    it('skips files with no content', async () => {
      mockFiles({});

      const res = await extractAllPackageFiles({}, ['buf.lock']);

      expect(res).toEqual([]);
    });
  });
});
