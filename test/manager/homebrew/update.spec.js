const got = require('got');
const fs = require('fs');
const { updateDependency } = require('../../../lib/manager/homebrew/update');

jest.mock('got');

const aide = fs.readFileSync('test/manager/homebrew/_fixtures/aide.rb', 'utf8');
const ibazel = fs.readFileSync(
  'test/manager/homebrew/_fixtures/ibazel.rb',
  'utf8'
);

describe('manager/homebrew/update', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('updates "releases" github dependency', async () => {
    const upgrade = {
      currentValue: 'v0.16.1',
      depName: 'Aide',
      ownerName: 'aide',
      repoName: 'aide',
      sha256:
        '0f2b7cecc70c1a27d35c06c98804fcdb9f326630de5d035afc447122186010b7',
      url:
        'https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz',
      newValue: 'v0.17.7',
    };
    got.mockReturnValueOnce({ body: 'some_content_1' });
    const newContent = await updateDependency(aide, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).not.toBe(aide);
    expect(newContent).toMatchSnapshot();
  });
  it('updates "archive" github dependency', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      ownerName: 'bazelbuild',
      repoName: 'bazel-watcher',
      sha256:
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
      url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      newValue: 'v0.9.3',
    };
    got.mockReturnValueOnce({ body: 'some_content_2' });
    const newContent = await updateDependency(ibazel, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).not.toBe(ibazel);
    expect(newContent).toMatchSnapshot();
  });
  it('returns unchanged content if got function throws errors', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      ownerName: 'bazelbuild',
      repoName: 'bazel-watcher',
      sha256:
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
      url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      newValue: 'v0.9.3',
    };
    got.mockImplementationOnce(() => {
      throw new Error('Request failed');
    });
    const newContent = await updateDependency(ibazel, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(ibazel);
  });
  it('returns unchanged content if url field in upgrade object is invalid', async () => {
    const content = ibazel;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      ownerName: 'bazelbuild',
      repoName: 'bazel-watcher',
      sha256:
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
      url: 'invalid_url',
      newValue: 'v0.9.3',
    };
    got.mockImplementationOnce(() => {
      return { body: 'some_content' };
    });
    const newContent = await updateDependency(content, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });
  it('returns unchanged content if repoName in upgrade object is invalid', async () => {
    const content = ibazel;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      ownerName: 'bazelbuild',
      repoName: 'invalid/repo/name',
      sha256:
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
      url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      newValue: 'v0.9.3',
    };
    got
      .mockImplementationOnce(() => {
        throw Error('Request failed');
      })
      .mockImplementationOnce(() => {
        return { body: 'some_content' };
      });
    const newContent = await updateDependency(content, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });
  it('returns unchanged content if repoName in upgrade object is wrong', async () => {
    const content = ibazel;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      ownerName: 'bazelbuild',
      repoName: 'wrong-version/archive/v10.2.3.tar.gz',
      sha256:
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
      url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      newValue: 'v0.9.3',
    };
    got
      .mockImplementationOnce(() => {
        throw Error('Request failed');
      })
      .mockImplementationOnce(() => {
        return { body: 'some_content' };
      });
    const newContent = await updateDependency(content, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });
  it('returns unchanged content if url field in Formula file is invalid', async () => {
    const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url ???https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      ownerName: 'bazelbuild',
      repoName: 'bazel-watcher',
      sha256:
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
      url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      newValue: 'v0.9.3',
    };
    got.mockImplementationOnce(() => {
      return { body: 'some_content' };
    });
    const newContent = await updateDependency(content, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });
  it('returns unchanged content if url field in Formula file is missing', async () => {
    const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      ownerName: 'bazelbuild',
      repoName: 'bazel-watcher',
      sha256:
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
      url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      newValue: 'v0.9.3',
    };
    got.mockImplementationOnce(() => {
      return { body: 'some_content' };
    });
    const newContent = await updateDependency(content, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });
  it('returns unchanged content if sha256 field in Formula file is invalid', async () => {
    const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 ???26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      ownerName: 'bazelbuild',
      repoName: 'bazel-watcher',
      sha256:
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
      url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      newValue: 'v0.9.3',
    };
    got.mockImplementationOnce(() => {
      return { body: 'some_content' };
    });
    const newContent = await updateDependency(content, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });
  it('returns unchanged content if sha256 field in Formula file is missing', async () => {
    const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          end
      `;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      ownerName: 'bazelbuild',
      repoName: 'bazel-watcher',
      sha256:
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
      url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      newValue: 'v0.9.3',
    };
    got.mockImplementationOnce(() => {
      return { body: 'some_content' };
    });
    const newContent = await updateDependency(content, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });
});
