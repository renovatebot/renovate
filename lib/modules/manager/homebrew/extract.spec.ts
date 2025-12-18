import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';

const aide = Fixtures.get('aide.rb.sample');
const ibazel = Fixtures.get('ibazel.rb.sample');

describe('modules/manager/homebrew/extract', () => {
  describe('extractPackageFile()', () => {
    it('skips sourceforge dependency 1', () => {
      const content = codeBlock`
        class Aalib < Formula
        desc "Portable ASCII art graphics library"
        homepage "https://aa-project.sourceforge.io/aalib/"
        url "https://downloads.sourceforge.net/aa-project/aalib-1.4rc5.tar.gz"
        sha256 "fbddda9230cf6ee2a4f5706b4b11e2190ae45f5eda1f0409dc4f99b35e0a70ee"
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            depName: 'Aalib',
            skipReason: 'unsupported-url',
          },
        ],
      });
    });

    it('skips sourceforge dependency 2', () => {
      const content = codeBlock`
        class Aap < Formula
        desc "Make-like tool to download, build, and install software"
        homepage "http://www.a-a-p.org"
        url "https://downloads.sourceforge.net/project/a-a-p/aap-1.094.zip"
        sha256 "3f53b2fc277756042449416150acc477f29de93692944f8a77e8cef285a1efd8"
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            depName: 'Aap',
            skipReason: 'unsupported-url',
          },
        ],
      });
    });

    it('skips github dependency with wrong format', () => {
      const content = codeBlock`
        class Acmetool < Formula
        desc "Automatic certificate acquisition tool for ACME (Let's Encrypt)"
        homepage "https://github.com/hlandau/acme"
        url "https://github.com/hlandau/acme.git",
          :tag      => "v0.0.67",
          :revision => "221ea15246f0bbcf254b350bee272d43a1820285"
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            depName: 'Acmetool',
            skipReason: 'invalid-sha256',
          },
        ],
      });
    });

    it('extracts "releases" github dependency', () => {
      const res = extractPackageFile(aide);

      expect(res).toStrictEqual({
        deps: [
          {
            currentValue: 'v0.16.1',
            datasource: 'github-releases',
            depName: 'aide/aide',
            managerData: {
              type: 'github',
              ownerName: 'aide',
              repoName: 'aide',
              sha256:
                '0f2b7cecc70c1a27d35c06c98804fcdb9f326630de5d035afc447122186010b7',
              url: 'https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz',
            },
          },
        ],
      });
    });

    it('extracts "archive" github dependency', () => {
      const res = extractPackageFile(ibazel);

      expect(res).toStrictEqual({
        deps: [
          {
            currentValue: 'v0.8.2',
            datasource: 'github-tags',
            depName: 'bazelbuild/bazel-watcher',
            managerData: {
              type: 'github',
              ownerName: 'bazelbuild',
              repoName: 'bazel-watcher',
              sha256:
                '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
              url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
            },
          },
        ],
      });
    });

    it('handles old "archive" github url format', () => {
      const content = codeBlock`
        class Ibazel < Formula
        desc 'IBazel is a tool for building Bazel targets when source files change.'
        homepage 'https://github.com/bazelbuild/bazel-watcher'
        url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
        sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            currentValue: 'v0.8.2',
            datasource: 'github-tags',
            depName: 'bazelbuild/bazel-watcher',
            managerData: {
              type: 'github',
              ownerName: 'bazelbuild',
              repoName: 'bazel-watcher',
              sha256:
                '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
              url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
            },
          },
        ],
      });
    });

    it('handles no space before class header', () => {
      const content = codeBlock`
        class Ibazel < Formula
        desc 'IBazel is a tool for building Bazel targets when source files change.'
        homepage 'https://github.com/bazelbuild/bazel-watcher'
        url "https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz"
        sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            currentValue: 'v0.8.2',
            datasource: 'github-tags',
            depName: 'bazelbuild/bazel-watcher',
            managerData: {
              type: 'github',
              ownerName: 'bazelbuild',
              repoName: 'bazel-watcher',
              sha256:
                '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
              url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
            },
          },
        ],
      });
    });

    it('returns null for invalid class header 1', () => {
      const content = codeBlock`
        class Ibazel !?# Formula
        desc 'IBazel is a tool for building Bazel targets when source files change.'
        homepage 'https://github.com/bazelbuild/bazel-watcher'
        url "https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz"
        sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toBeNull();
    });

    it('returns null for invalid class header 2', () => {
      const content = codeBlock`
        class Ibazel < NotFormula
        desc 'IBazel is a tool for building Bazel targets when source files change.'
        homepage 'https://github.com/bazelbuild/bazel-watcher'
        url "https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz"
        sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toBeNull();
    });

    it('skips if there is no url field', () => {
      const content = codeBlock`
        class Ibazel < Formula
        desc 'IBazel is a tool for building Bazel targets when source files change.'
        homepage 'https://github.com/bazelbuild/bazel-watcher'
        not_url "https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz"
        sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            depName: 'Ibazel',
            skipReason: 'unsupported-url',
          },
        ],
      });
    });

    it('skips if invalid url protocol', () => {
      const content = codeBlock`
        class Ibazel < Formula
        desc 'IBazel is a tool for building Bazel targets when source files change.'
        homepage 'https://github.com/bazelbuild/bazel-watcher'
        url ??https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz"
        sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            depName: 'Ibazel',
            skipReason: 'unsupported-url',
          },
        ],
      });
    });

    it('skips if invalid url', () => {
      const content = codeBlock`
        class Ibazel < Formula
        desc 'IBazel is a tool for building Bazel targets when source files change.'
        homepage 'https://github.com/bazelbuild/bazel-watcher'
        url "invalid_url"
        sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            depName: 'Ibazel',
            skipReason: 'unsupported-url',
          },
        ],
      });
    });

    it('skips if there is no sha256 field', () => {
      const content = codeBlock`
        class Ibazel < Formula
        desc 'IBazel is a tool for building Bazel targets when source files change.'
        homepage 'https://github.com/bazelbuild/bazel-watcher'
        url "https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz"
        not_sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            depName: 'Ibazel',
            skipReason: 'invalid-sha256',
          },
        ],
      });
    });

    it('skips if sha256 field is invalid', () => {
      const content = codeBlock`
        class Ibazel < Formula
        desc 'IBazel is a tool for building Bazel targets when source files change.'
        homepage 'https://github.com/bazelbuild/bazel-watcher'
        url "https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz"
        sha256 '26f5125218fad2741d3caf937b0229'
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            depName: 'Ibazel',
            skipReason: 'invalid-sha256',
          },
        ],
      });
    });

    it('extracts npm scoped package dependency', () => {
      const content = codeBlock`
        class ClaudeCode < Formula
        desc "Anthropic's official CLI for Claude"
        homepage "https://www.anthropic.com/claude-code"
        url "https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-0.1.0.tgz"
        sha256 "345eae3fe4c682df3d8876141f32035bb2898263ce5a406e76e1d74ccb13f601"
        license "Proprietary"
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            currentValue: '0.1.0',
            datasource: 'npm',
            depName: '@anthropic-ai/claude-code',
            managerData: {
              type: 'npm',
              packageName: '@anthropic-ai/claude-code',
              sha256:
                '345eae3fe4c682df3d8876141f32035bb2898263ce5a406e76e1d74ccb13f601',
              url: 'https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-0.1.0.tgz',
            },
          },
        ],
      });
    });

    it('extracts npm unscoped package dependency', () => {
      const content = codeBlock`
        class Express < Formula
        desc "Fast, unopinionated, minimalist web framework"
        homepage "https://expressjs.com/"
        url "https://registry.npmjs.org/express/-/express-4.18.2.tgz"
        sha256 "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234"
        license "MIT"
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            currentValue: '4.18.2',
            datasource: 'npm',
            depName: 'express',
            managerData: {
              type: 'npm',
              packageName: 'express',
              sha256:
                'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
              url: 'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
            },
          },
        ],
      });
    });

    it('skips npm package from custom registry', () => {
      const content = codeBlock`
        class CustomPackage < Formula
        desc "Package from custom registry"
        homepage "https://example.com"
        url "https://registry.company.com/package/-/package-1.0.0.tgz"
        sha256 "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234"
        end
      `;

      const res = extractPackageFile(content);

      expect(res).toStrictEqual({
        deps: [
          {
            depName: 'CustomPackage',
            skipReason: 'unsupported-url',
          },
        ],
      });
    });
  });
});
