import { BufPluginDatasource } from '../../datasource/buf-plugin/index.ts';
import { extractPackageFile } from './index.ts';

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
      expect(res?.deps[0]).toMatchObject({
        depName: 'owner/name',
        registryUrls: ['https://bsr.example.com'],
        currentValue: 'v0.1.0',
      });
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
  });
});
