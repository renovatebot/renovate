import fs from 'fs';
import { extractPackageFile } from './extract';

const aalib = fs.readFileSync(
  'lib/manager/homebrew/__fixtures__/aalib.rb',
  'utf8'
);
const aap = fs.readFileSync('lib/manager/homebrew/__fixtures__/aap.rb', 'utf8');
const acmetool = fs.readFileSync(
  'lib/manager/homebrew/__fixtures__/acmetool.rb',
  'utf8'
);
const aide = fs.readFileSync(
  'lib/manager/homebrew/__fixtures__/aide.rb',
  'utf8'
);
const ibazel = fs.readFileSync(
  'lib/manager/homebrew/__fixtures__/ibazel.rb',
  'utf8'
);

describe('lib/manager/homebrew/extract', () => {
  describe('extractPackageFile()', () => {
    it('skips sourceforge dependency', () => {
      const res = extractPackageFile({ fileContent: aalib });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });
    it('skips sourceforge dependency', () => {
      const res = extractPackageFile({ fileContent: aap });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });
    it('skips github dependency with wrong format', () => {
      const res = extractPackageFile({ fileContent: acmetool });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });
    it('extracts "releases" github dependency', () => {
      const res = extractPackageFile({ fileContent: aide });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBeUndefined();
      expect(res).toMatchSnapshot();
    });
    it('extracts "archive" github dependency', () => {
      const res = extractPackageFile({ fileContent: ibazel });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBeUndefined();
      expect(res).toMatchSnapshot();
    });
    it('handles no space before class header', () => {
      const fileContent = `class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile({ fileContent });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBeUndefined();
      expect(res).toMatchSnapshot();
    });
    it('returns null for invalid class header', () => {
      const fileContent = `
          class Ibazel !?# Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      expect(extractPackageFile({ fileContent })).toBeNull();
    });
    it('returns null for invalid class header', () => {
      const fileContent = `
          class Ibazel < NotFormula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      expect(extractPackageFile({ fileContent })).toBeNull();
    });
    it('skips if there is no url field', () => {
      const fileContent = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          not_url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile({ fileContent });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });
    it('skips if invalid url field', () => {
      const fileContent = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.not_tar.not_gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile({ fileContent });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });
    it('skips if invalid url field', () => {
      const fileContent = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/vInvalid.version.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile({ fileContent });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });
    it('skips if invalid url field', () => {
      const fileContent = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url ??https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile({ fileContent });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });
    it('skips if invalid url field', () => {
      const fileContent = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "invalid_url"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile({ fileContent });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });
    it('skips if there is no sha256 field', () => {
      const fileContent = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          not_sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile({ fileContent });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBe('invalid-sha256');
      expect(res).toMatchSnapshot();
    });
    it('skips if sha256 field is invalid', () => {
      const fileContent = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b0229'
          end
      `;
      const res = extractPackageFile({ fileContent });
      expect(res).not.toBeNull();
      expect(res.deps[0].skipReason).toBe('invalid-sha256');
      expect(res).toMatchSnapshot();
    });
  });
});
