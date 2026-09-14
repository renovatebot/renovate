import { codeBlock } from 'common-tags';
import upath from 'upath';
import { fs } from '../../../../test/util.ts';
import { BufModuleDatasource } from '../../datasource/buf-module/index.ts';
import { BufPluginDatasource } from '../../datasource/buf-plugin/index.ts';
import { extractAllPackageFiles, extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

/** Back the fs mock with an in-memory `path -> content` map. */
function mockFiles(files: Record<string, string>): void {
  fs.readLocalFile.mockImplementation((f) =>
    Promise.resolve((files[f] ?? null) as never),
  );
  fs.localPathIsFile.mockImplementation((f) => Promise.resolve(f in files));
  fs.getSiblingFileName.mockImplementation((file, name) =>
    upath.join(upath.dirname(file), name),
  );
}

describe('modules/manager/buf/extract', () => {
  describe('extractPackageFile()', () => {
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

  describe('extractAllPackageFiles()', () => {
    it('skips files with no content', async () => {
      mockFiles({});
      await expect(extractAllPackageFiles({}, ['buf.yaml'])).resolves.toEqual(
        [],
      );
    });

    it('dispatches buf.gen.yaml to the plugin extractor', async () => {
      mockFiles({
        'buf.gen.yaml': codeBlock`
          version: v2
          plugins:
            - remote: buf.build/bufbuild/connect-go:v1.10.0
              out: gen/go
        `,
      });
      const res = await extractAllPackageFiles({}, ['buf.gen.yaml']);
      expect(res).toEqual([
        {
          packageFile: 'buf.gen.yaml',
          deps: [
            {
              depName: 'bufbuild/connect-go',
              datasource: BufPluginDatasource.id,
              registryUrls: ['https://buf.build'],
              currentValue: 'v1.10.0',
              replaceString: 'buf.build/bufbuild/connect-go:v1.10.0',
              autoReplaceStringTemplate:
                'buf.build/bufbuild/connect-go:{{#if newValue}}{{newValue}}{{/if}}',
            },
          ],
        },
      ]);
    });

    it('drops a buf.gen.yaml with no remote plugins', async () => {
      mockFiles({ 'buf.gen.yaml': 'version: v2' });
      await expect(
        extractAllPackageFiles({}, ['buf.gen.yaml']),
      ).resolves.toEqual([]);
    });

    it('pairs a v2 buf.yaml with its sibling buf.lock', async () => {
      mockFiles({
        'buf.yaml': codeBlock`
          version: v2
          deps:
            - buf.build/googleapis/googleapis
            - buf.build/acme/weather:staging
        `,
        'buf.lock': codeBlock`
          version: v2
          deps:
            - name: buf.build/googleapis/googleapis
              commit: 62f35d8aed1149c291d606d958a7ce32
              digest: b5:abc
        `,
      });
      const res = await extractAllPackageFiles({}, ['buf.yaml']);
      expect(res).toEqual([
        {
          packageFile: 'buf.yaml',
          lockFiles: ['buf.lock'],
          deps: [
            {
              depName: 'googleapis/googleapis',
              datasource: BufModuleDatasource.id,
              registryUrls: ['https://buf.build'],
              currentDigest: '62f35d8aed1149c291d606d958a7ce32',
            },
            {
              depName: 'acme/weather',
              datasource: BufModuleDatasource.id,
              registryUrls: ['https://buf.build'],
              currentValue: 'staging',
              skipReason: 'unversioned-reference',
            },
          ],
        },
      ]);
    });

    it('reads commits from a v1 buf.lock', async () => {
      mockFiles({
        'buf.yaml': codeBlock`
          version: v1
          deps:
            - buf.build/googleapis/googleapis
        `,
        'buf.lock': codeBlock`
          version: v1
          deps:
            - remote: buf.build
              owner: googleapis
              repository: googleapis
              commit: 62f35d8aed1149c291d606d958a7ce32
              digest: shake256:def
        `,
      });
      const res = await extractAllPackageFiles({}, ['buf.yaml']);
      expect(res[0].deps[0]).toMatchObject({
        depName: 'googleapis/googleapis',
        currentDigest: '62f35d8aed1149c291d606d958a7ce32',
      });
    });

    it('flags deps with no buf.lock at all', async () => {
      mockFiles({
        'buf.yaml': codeBlock`
          version: v2
          deps:
            - buf.build/googleapis/googleapis
        `,
      });
      const res = await extractAllPackageFiles({}, ['buf.yaml']);
      expect(res).toEqual([
        {
          packageFile: 'buf.yaml',
          deps: [
            {
              depName: 'googleapis/googleapis',
              datasource: BufModuleDatasource.id,
              registryUrls: ['https://buf.build'],
              skipReason: 'unversioned-reference',
            },
          ],
        },
      ]);
    });

    it('ignores malformed dep references', async () => {
      mockFiles({
        'buf.yaml': codeBlock`
          version: v2
          deps:
            - not-a-module-reference
        `,
      });
      await expect(extractAllPackageFiles({}, ['buf.yaml'])).resolves.toEqual(
        [],
      );
    });

    it('returns nothing for a buf.yaml with no deps', async () => {
      mockFiles({ 'buf.yaml': 'version: v2' });
      await expect(extractAllPackageFiles({}, ['buf.yaml'])).resolves.toEqual(
        [],
      );
    });

    it('skips a malformed buf.yaml', async () => {
      mockFiles({ 'buf.yaml': '}}}not yaml' });
      await expect(extractAllPackageFiles({}, ['buf.yaml'])).resolves.toEqual(
        [],
      );
    });

    it('tolerates a malformed buf.lock', async () => {
      mockFiles({
        'buf.yaml': codeBlock`
          version: v2
          deps:
            - buf.build/googleapis/googleapis
        `,
        'buf.lock': '}}}not yaml',
      });
      const res = await extractAllPackageFiles({}, ['buf.yaml']);
      expect(res).toEqual([
        {
          packageFile: 'buf.yaml',
          lockFiles: ['buf.lock'],
          deps: [
            {
              depName: 'googleapis/googleapis',
              datasource: BufModuleDatasource.id,
              registryUrls: ['https://buf.build'],
              skipReason: 'unversioned-reference',
            },
          ],
        },
      ]);
    });

    it('skips buf.lock entries missing a commit or module identity', async () => {
      mockFiles({
        'buf.yaml': codeBlock`
          version: v2
          deps:
            - buf.build/googleapis/googleapis
        `,
        'buf.lock': codeBlock`
          version: v2
          deps:
            - name: buf.build/googleapis/googleapis
              digest: b5:nocommit
            - commit: 0000000000000000000000000000dead
        `,
      });
      const res = await extractAllPackageFiles({}, ['buf.yaml']);
      expect(res[0].deps[0].currentDigest).toBeUndefined();
      expect(res[0].deps[0].skipReason).toBe('unversioned-reference');
    });
  });
});
