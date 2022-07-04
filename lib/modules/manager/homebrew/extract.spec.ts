import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const aalib = Fixtures.get('aalib.rb');
const aap = Fixtures.get('aap.rb');
const acmetool = Fixtures.get('acmetool.rb');
const aide = Fixtures.get('aide.rb');
const ibazel = Fixtures.get('ibazel.rb');

describe('modules/manager/homebrew/extract', () => {
  describe('extractPackageFile()', () => {
    it('skips sourceforge dependency 1', () => {
      const res = extractPackageFile(aalib);
      expect(res).not.toBeNull();
      expect(res?.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });

    it('skips sourceforge dependency 2', () => {
      const res = extractPackageFile(aap);
      expect(res).not.toBeNull();
      expect(res?.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });

    it('skips github dependency with wrong format', () => {
      const res = extractPackageFile(acmetool);
      expect(res).not.toBeNull();
      expect(res?.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });

    it('extracts "releases" github dependency', () => {
      const res = extractPackageFile(aide);
      expect(res).not.toBeNull();
      expect(res?.deps[0].skipReason).toBeUndefined();
      expect(res).toMatchSnapshot();
    });

    it('extracts "archive" github dependency', () => {
      const res = extractPackageFile(ibazel);
      expect(res).not.toBeNull();
      expect(res?.deps[0].skipReason).toBeUndefined();
      expect(res).toMatchSnapshot();
    });

    it('handles no space before class header', () => {
      const content = `class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile(content);
      expect(res).not.toBeNull();
      expect(res?.deps[0].skipReason).toBeUndefined();
      expect(res).toMatchSnapshot();
    });

    it('returns null for invalid class header 1', () => {
      const content = `
          class Ibazel !?# Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      expect(extractPackageFile(content)).toBeNull();
    });

    it('returns null for invalid class header 2', () => {
      const content = `
          class Ibazel < NotFormula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      expect(extractPackageFile(content)).toBeNull();
    });

    it('skips if there is no url field', () => {
      const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          not_url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile(content);
      expect(res).not.toBeNull();
      expect(res?.deps[0].skipReason).toBe('unsupported-url');
      expect(res).toMatchSnapshot();
    });

    it('skips if invalid url protocol', () => {
      const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url ??https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile(content);
      expect(res).toMatchSnapshot({
        deps: [{ depName: 'Ibazel', skipReason: 'unsupported-url' }],
      });
    });

    it('skips if invalid url', () => {
      const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "invalid_url"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile(content);
      expect(res).toMatchSnapshot({
        deps: [{ depName: 'Ibazel', skipReason: 'unsupported-url' }],
      });
    });

    it('skips if there is no sha256 field', () => {
      const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          not_sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
      const res = extractPackageFile(content);
      expect(res).not.toBeNull();
      expect(res?.deps[0].skipReason).toBe('invalid-sha256');
      expect(res).toMatchSnapshot();
    });

    it('skips if sha256 field is invalid', () => {
      const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b0229'
          end
      `;
      const res = extractPackageFile(content);
      expect(res).not.toBeNull();
      expect(res?.deps[0].skipReason).toBe('invalid-sha256');
      expect(res).toMatchSnapshot();
    });
  });
});
