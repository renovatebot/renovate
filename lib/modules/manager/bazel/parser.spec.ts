import { codeBlock } from 'common-tags';
import { parse } from './parser';
import { extract } from './rules';

describe('modules/manager/bazel/parser', () => {
  it('parses rules input', () => {
    const input = codeBlock`
      go_repository(name = "foo")
      maybe(go_repository, name = "bar", deps = ["baz", "qux"])
    `;

    const res = parse(input);

    expect(res).toEqual([
      {
        type: 'record',
        value: 'go_repository(name = "foo")',
        offset: 0,
        children: {
          rule: { type: 'string', value: 'go_repository', offset: 0 },
          name: { type: 'string', value: 'foo', offset: 22 },
        },
      },
      {
        type: 'record',
        value: 'maybe(go_repository, name = "bar", deps = ["baz", "qux"])',
        offset: 28,
        children: {
          rule: { type: 'string', value: 'go_repository', offset: 34 },
          name: { type: 'string', value: 'bar', offset: 57 },
          deps: {
            type: 'array',
            value: '["baz", "qux"]',
            offset: 70,
            children: [
              { type: 'string', value: 'baz', offset: 72 },
              { type: 'string', value: 'qux', offset: 79 },
            ],
          },
        },
      },
    ]);
    expect(res?.map(extract)).toMatchObject([
      { rule: 'go_repository', name: 'foo' },
      { rule: 'go_repository', name: 'bar', deps: ['baz', 'qux'] },
    ]);
  });

  it('parses multiple archives', () => {
    const input = codeBlock`
      http_archive(
          name = "aspect_rules_js",
          sha256 = "db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598",
          strip_prefix = "rules_js-1.1.2",
          url = "https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz",
      )
      http_archive(
        name = "rules_nodejs",
        sha256 = "5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064",
        urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz"],
      )
    `;

    const res = parse(input);

    expect(res).toMatchObject([
      {
        children: {
          rule: { value: 'http_archive' },
          name: { value: 'aspect_rules_js' },
          sha256: {
            value:
              'db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598',
          },
          strip_prefix: { value: 'rules_js-1.1.2' },
          url: {
            value:
              'https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz',
          },
        },
      },
      {
        children: {
          rule: { value: 'http_archive' },
          name: { value: 'rules_nodejs' },
          sha256: {
            value:
              '5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064',
          },
          urls: {
            type: 'array',
            children: [
              {
                value:
                  'https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz',
              },
            ],
          },
        },
      },
    ]);

    expect(res?.map(extract)).toMatchObject([
      {
        rule: 'http_archive',
        name: 'aspect_rules_js',
        sha256:
          'db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598',
        strip_prefix: 'rules_js-1.1.2',
        url: 'https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz',
      },
      {
        rule: 'http_archive',
        name: 'rules_nodejs',
        sha256:
          '5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064',
        urls: [
          'https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz',
        ],
      },
    ]);
  });

  it('parses http_archive', () => {
    const input = codeBlock`
      http_archive(
        name = "rules_nodejs",
        sha256 = "5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064",
        url = "https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz",
      )
    `;

    const res = parse(input);

    expect(res).toMatchObject([
      {
        children: {
          name: { value: 'rules_nodejs' },
          rule: { value: 'http_archive' },
          sha256: {
            value:
              '5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064',
          },
          url: {
            value:
              'https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz',
          },
        },
      },
    ]);

    expect(res?.map(extract)).toMatchObject([
      {
        rule: 'http_archive',
        name: 'rules_nodejs',
        sha256:
          '5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064',
        url: 'https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz',
      },
    ]);
  });

  it('parses http_archive with prefixes and multiple urls', () => {
    const input = codeBlock`
      http_archive(
        name = "bazel_toolchains",
        sha256 = "4b1468b254a572dbe134cc1fd7c6eab1618a72acd339749ea343bd8f55c3b7eb",
        strip_prefix = "bazel-toolchains-d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-toolchains/archive/d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4.tar.gz",
            "https://github.com/bazelbuild/bazel-toolchains/archive/d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4.tar.gz",
        ],
      )
    `;

    const res = parse(input);

    expect(res).toMatchObject([
      {
        children: {
          name: { value: 'bazel_toolchains' },
          rule: { value: 'http_archive' },
          sha256: {
            value:
              '4b1468b254a572dbe134cc1fd7c6eab1618a72acd339749ea343bd8f55c3b7eb',
          },
          strip_prefix: {
            value: 'bazel-toolchains-d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4',
          },
          urls: {
            children: [
              {
                value:
                  'https://mirror.bazel.build/github.com/bazelbuild/bazel-toolchains/archive/d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4.tar.gz',
              },
              {
                value:
                  'https://github.com/bazelbuild/bazel-toolchains/archive/d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4.tar.gz',
              },
            ],
          },
        },
      },
    ]);

    expect(res?.map(extract)).toMatchObject([
      {
        name: 'bazel_toolchains',
        rule: 'http_archive',
        sha256:
          '4b1468b254a572dbe134cc1fd7c6eab1618a72acd339749ea343bd8f55c3b7eb',
        strip_prefix:
          'bazel-toolchains-d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4',
        urls: [
          'https://mirror.bazel.build/github.com/bazelbuild/bazel-toolchains/archive/d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4.tar.gz',
          'https://github.com/bazelbuild/bazel-toolchains/archive/d665ccfa3e9c90fa789671bf4ef5f7c19c5715c4.tar.gz',
        ],
      },
    ]);
  });

  it('parses Maven', () => {
    const input = codeBlock`
      maven_install(
        artifacts = [
          "com.example1:foo:1.1.1",
          maven.artifact(
            group = "com.example2",
            artifact = "bar",
            version = "2.2.2",
          ),
          maven.artifact(
            "com.example3",
            "baz",
            "3.3.3",
            neverlink = True
          )
        ],
        repositories = [
          "https://example1.com/maven2",
          "https://example2.com/maven2",
        ]
      )
    `;

    const res = parse(input);

    expect(res?.map(extract)).toEqual([
      {
        rule: 'maven_install',
        artifacts: [
          'com.example1:foo:1.1.1',
          {
            _function: 'maven.artifact',
            group: 'com.example2',
            artifact: 'bar',
            version: '2.2.2',
          },
          {
            _function: 'maven.artifact',
            '0': 'com.example3',
            '1': 'baz',
            '2': '3.3.3',
          },
        ],
        repositories: [
          'https://example1.com/maven2',
          'https://example2.com/maven2',
        ],
      },
    ]);
  });
});
