import { codeBlock } from 'common-tags';
import { fs, logger } from '~test/util.ts';
import { BufModuleDatasource } from '../../datasource/buf-module/index.ts';
import { BufPluginDatasource } from '../../datasource/buf-plugin/index.ts';
import { extractPackageFile } from './index.ts';

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
});
