import { codeBlock } from 'common-tags';
import upath from 'upath';
import { Fixtures } from '~test/fixtures.ts';
import { fs } from '~test/util.ts';
import type { PackageDependency } from '../types.ts';
import { extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const wolfi = 'https://packages.wolfi.dev/os';
const alpineMain = 'https://dl-cdn.alpinelinux.org/alpine/v3.22/main';
const alpineCommunity = 'https://dl-cdn.alpinelinux.org/alpine/v3.22/community';
const edgeMain = 'https://dl-cdn.alpinelinux.org/alpine/edge/main';
const chainguard = 'https://apk.cgr.dev/chainguard';

const defaultArchs = [
  'x86',
  'x86_64',
  'aarch64',
  'armhf',
  'armv7',
  'loongarch64',
  'ppc64le',
  'riscv64',
  's390x',
] as const;

function registryUrl(repository: string, arch: string): string {
  return `${repository}?arch=${arch}`;
}

function wolfiArchs(archs: readonly string[]): string[] {
  return archs.map((arch) => registryUrl(wolfi, arch));
}

const wolfiX86 = registryUrl(wolfi, 'x86_64');

function yaml(options: {
  include?: string;
  repositories?: string[];
  buildRepositories?: string[];
  runtimeRepositories?: string[];
  packages?: string[];
  archs?: string[];
}): string {
  const lines: string[] = [];
  if (options.include) {
    lines.push(`include: ${options.include}`);
  }
  lines.push('contents:');
  function list(key: string, values: string[] | undefined): void {
    if (!values) {
      return;
    }
    if (values.length === 0) {
      lines.push(`  ${key}: []`);
      return;
    }
    lines.push(`  ${key}:`);
    for (const value of values) {
      lines.push(`    - '${value}'`);
    }
  }
  list('repositories', options.repositories);
  list('build_repositories', options.buildRepositories);
  list('runtime_repositories', options.runtimeRepositories);
  list('packages', options.packages);
  if (options.archs) {
    lines.push('archs:');
    for (const arch of options.archs) {
      lines.push(`  - '${arch}'`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function pin(
  spec: string,
  depName: string,
  currentValue: string,
  registryUrls: string[],
  template = `${depName}={{{newValue}}}`,
): PackageDependency {
  return {
    datasource: 'apk',
    depName,
    currentValue,
    replaceString: spec,
    autoReplaceStringTemplate: template,
    registryUrls,
  };
}

describe('modules/manager/apko/extract', () => {
  beforeEach(() => {
    fs.getSiblingFileName.mockImplementation(
      (fileName: string, siblingName: string) =>
        upath.join(upath.dirname(fileName), siblingName),
    );
    fs.readLocalFile.mockResolvedValue(null);
  });

  it('returns null for an empty file', async () => {
    await expect(extractPackageFile('', 'apko.yaml')).resolves.toBeNull();
  });

  it('returns null for malformed YAML', async () => {
    await expect(extractPackageFile(':\n', 'apko.yaml')).resolves.toBeNull();
  });

  it('returns null when packages is not a list', async () => {
    const content = codeBlock`
      contents:
        packages: bash
    `;
    await expect(extractPackageFile(content, 'apko.yaml')).resolves.toBeNull();
  });

  it('returns null when packages is null', async () => {
    await expect(
      extractPackageFile(
        `contents:
  repositories:
    - ${wolfi}
  packages:
archs:
  - amd64
`,
        'apko.yaml',
      ),
    ).resolves.toBeNull();
  });

  it('returns null when the file has no packages', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toBeNull();
  });

  it('returns null for an empty package list', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: [],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toBeNull();
  });

  it('returns null when every package spec is ignored', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: [
            '!conflicting',
            '.build-deps',
            './bash-5.2.37-r2.apk',
            'https://example.com/bash-5.2.37-r2.apk',
            'so:libc.musl-x86_64.so.1',
            'cmd:node',
            '$PACKAGE',
          ],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toBeNull();
  });

  it('extracts a Wolfi pin for amd64', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: ['bash=5.2.37-r2'],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [wolfiX86])],
    });
  });

  it('keeps an Alpine repository path and appends each arch', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: [alpineMain],
          packages: ['bash=5.2.37-r2'],
          archs: ['amd64', 'arm64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [
          registryUrl(alpineMain, 'x86_64'),
          registryUrl(alpineMain, 'aarch64'),
        ]),
      ],
    });
  });

  it('orders repositories, then build repositories, then YAML archs, and drops query URLs', async () => {
    await expect(
      extractPackageFile(Fixtures.get('order.yaml'), 'apko.yaml'),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [
          registryUrl(alpineMain, 'aarch64'),
          registryUrl(alpineMain, 'x86_64'),
          registryUrl(alpineCommunity, 'aarch64'),
          registryUrl(alpineCommunity, 'x86_64'),
          registryUrl(wolfi, 'aarch64'),
          registryUrl(wolfi, 'x86_64'),
        ]),
      ],
    });
  });

  it('uses AllArchs order when archs is an empty list', async () => {
    await expect(
      extractPackageFile(
        `contents:
  repositories:
    - ${wolfi}
  packages:
    - bash=5.2.37-r2
archs: []
`,
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', wolfiArchs(defaultArchs)),
      ],
    });
  });

  it('uses AllArchs order when archs is omitted', async () => {
    await expect(
      extractPackageFile(Fixtures.get('no-archs.yaml'), 'apko.yaml'),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', wolfiArchs(defaultArchs)),
      ],
    });
  });

  it('uses AllArchs order when archs is all', async () => {
    await expect(
      extractPackageFile(Fixtures.get('all-archs.yaml'), 'apko.yaml'),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', wolfiArchs(defaultArchs)),
      ],
    });
  });

  it('maps an unquoted 386 arch to x86', async () => {
    await expect(
      extractPackageFile(
        `contents:
  repositories:
    - ${wolfi}
  packages:
    - bash=5.2.37-r2
archs: [386]
`,
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [registryUrl(wolfi, 'x86')]),
      ],
    });
  });

  it('maps a mixed list of an unquoted 386 and x86_64', async () => {
    await expect(
      extractPackageFile(
        `contents:
  repositories:
    - ${wolfi}
  packages:
    - bash=5.2.37-r2
archs: [386, x86_64]
`,
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [
          registryUrl(wolfi, 'x86'),
          wolfiX86,
        ]),
      ],
    });
  });

  it('uses AllArchs order when archs is null', async () => {
    await expect(
      extractPackageFile(
        `contents:
  repositories:
    - ${wolfi}
  packages:
    - bash=5.2.37-r2
archs:
`,
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', wolfiArchs(defaultArchs)),
      ],
    });
  });

  it('uses build repositories when repositories is null', async () => {
    await expect(
      extractPackageFile(
        `contents:
  repositories:
  build_repositories:
    - ${wolfi}
  packages:
    - bash=5.2.37-r2
archs:
  - amd64
`,
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [wolfiX86])],
    });
  });

  it('translates apko arch names and keeps apk arch names', async () => {
    const archs = [
      '386',
      'x86',
      'amd64',
      'x86_64',
      'arm64',
      'aarch64',
      'arm/v6',
      'armhf',
      'arm/v7',
      'loong64',
      'loongarch64',
      'ppc64le',
      'riscv64',
      's390x',
    ];
    const apkArchs = [
      'x86',
      'x86',
      'x86_64',
      'x86_64',
      'aarch64',
      'aarch64',
      'armhf',
      'armhf',
      'armv7',
      'loongarch64',
      'loongarch64',
      'ppc64le',
      'riscv64',
      's390x',
    ];

    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: ['bash=5.2.37-r2'],
          archs,
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', wolfiArchs(apkArchs))],
    });
  });

  it('ignores runtime_repositories', async () => {
    await expect(
      extractPackageFile(Fixtures.get('repos-runtime.yaml'), 'apko.yaml'),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [
          wolfiX86,
          registryUrl(chainguard, 'x86_64'),
        ]),
      ],
    });
  });

  it('skips a versioned package when every repository URL has a query', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: ['https://mirror.example.com/os?token=secret'],
          packages: ['bash=5.2.37-r2'],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
          skipReason: 'unknown-registry',
        },
      ],
    });
  });

  it('skips a versioned package when repositories is empty and archs is omitted', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: [],
          packages: ['bash=5.2.37-r2'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
          skipReason: 'unknown-registry',
        },
      ],
    });
  });

  it('skips a versioned package when the file has no repositories and archs is set', async () => {
    await expect(
      extractPackageFile(
        yaml({
          packages: ['bash=5.2.37-r2'],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
          skipReason: 'unknown-registry',
        },
      ],
    });
  });

  it('skips a versioned package when the file has no repositories', async () => {
    await expect(
      extractPackageFile(
        yaml({
          packages: ['bash=5.2.37-r2'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
          skipReason: 'unknown-registry',
        },
      ],
    });
  });

  it('drops file repositories and keeps http repositories', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: ['./packages', '@local /packages', wolfi],
          packages: ['bash=5.2.37-r2'],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [wolfiX86])],
    });
  });

  it('extracts unversioned names and a pin in file order', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: ['wolfi-base', 'python-3.14', 'bash=5.2.37-r2'],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        {
          datasource: 'apk',
          depName: 'wolfi-base',
          skipReason: 'unspecified-version',
        },
        {
          datasource: 'apk',
          depName: 'python-3.14',
          skipReason: 'unspecified-version',
        },
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [wolfiX86]),
      ],
    });
  });

  it('extracts hyphenated names and pins without a revision', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: ['ca-certificates-bundle=20241121-r0', 'nginx=1.24.0'],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        pin(
          'ca-certificates-bundle=20241121-r0',
          'ca-certificates-bundle',
          '20241121-r0',
          [wolfiX86],
          'ca-certificates-bundle={{{newValue}}}',
        ),
        pin(
          'nginx=1.24.0',
          'nginx',
          '1.24.0',
          [wolfiX86],
          'nginx={{{newValue}}}',
        ),
      ],
    });
  });

  it('reads a quoted package scalar without the quotes', async () => {
    const content = codeBlock`
      contents:
        repositories:
          - https://packages.wolfi.dev/os
        packages:
          - "bash=5.2.37-r2"
      archs:
        - amd64
    `;

    await expect(extractPackageFile(content, 'apko.yaml')).resolves.toEqual({
      deps: [pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [wolfiX86])],
    });
  });

  it.each`
    spec           | currentValue
    ${'bash=~5.2'} | ${'=~5.2'}
    ${'bash~5.2'}  | ${'~5.2'}
    ${'bash~=5.2'} | ${'~=5.2'}
    ${'bash>5.2'}  | ${'>5.2'}
    ${'bash<5.2'}  | ${'<5.2'}
    ${'bash>=5.2'} | ${'>=5.2'}
    ${'bash<=5.2'} | ${'<=5.2'}
    ${'bash>~5.2'} | ${'>~5.2'}
    ${'bash<~5.2'} | ${'<~5.2'}
  `(
    'extracts $spec as the range $currentValue',
    async ({ spec, currentValue }: { spec: string; currentValue: string }) => {
      await expect(
        extractPackageFile(
          yaml({
            repositories: [wolfi],
            packages: [spec],
            archs: ['amd64'],
          }),
          'apko.yaml',
        ),
      ).resolves.toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'bash',
            currentValue,
            replaceString: spec,
            autoReplaceStringTemplate: 'bash{{{newValue}}}',
            registryUrls: [wolfiX86],
          },
        ],
      });
    },
  );

  it.each`
    spec                                  | skipReason
    ${'bash=$VERSION'}                    | ${'contains-variable'}
    ${'bash=not-a-version'}               | ${'unsupported-version'}
    ${'bash><Q12lvT0pPK3aQaUWmI9djiLpFg'} | ${'unsupported-version'}
  `(
    'skips $spec with $skipReason',
    async ({ spec, skipReason }: { spec: string; skipReason: string }) => {
      await expect(
        extractPackageFile(
          yaml({
            repositories: [wolfi],
            packages: [spec],
            archs: ['amd64'],
          }),
          'apko.yaml',
        ),
      ).resolves.toEqual({
        deps: [
          {
            datasource: 'apk',
            depName: 'bash',
            skipReason,
          },
        ],
      });
    },
  );

  it('drops ignored specs and keeps the pin', async () => {
    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: [
            '!conflicting',
            '.build-deps',
            './bash-5.2.37-r2.apk',
            'https://example.com/bash-5.2.37-r2.apk',
            'so:libc.musl-x86_64.so.1',
            'cmd:node',
            '$PACKAGE',
            'bash=5.2.37-r2',
          ],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [wolfiX86])],
    });
  });

  it('limits untagged packages to untagged repositories and puts a declared tag before them', async () => {
    const untagged = [wolfi, alpineCommunity].flatMap((repository) => [
      registryUrl(repository, 'x86_64'),
      registryUrl(repository, 'aarch64'),
    ]);
    const edge = [
      registryUrl(edgeMain, 'x86_64'),
      registryUrl(edgeMain, 'aarch64'),
    ];

    await expect(
      extractPackageFile(Fixtures.get('tags.yaml'), 'apko.yaml'),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', untagged),
        pin(
          'nodejs@edge=22.13.1-r0',
          'nodejs',
          '22.13.1-r0',
          [...edge, ...untagged],
          'nodejs@edge={{{newValue}}}',
        ),
        {
          datasource: 'apk',
          depName: 'libpcap',
          skipReason: 'local-dependency',
        },
        pin(
          'busybox@missing=1.36.1-r0',
          'busybox',
          '1.36.1-r0',
          untagged,
          'busybox@missing={{{newValue}}}',
        ),
      ],
    });
  });

  it('sets lockedVersion when every arch agrees', async () => {
    fs.readLocalFile.mockResolvedValue(Fixtures.get('lock-agree.json'));

    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: ['bash=5.2.37-r2'],
          archs: ['amd64', 'arm64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        {
          ...pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [
            wolfiX86,
            registryUrl(wolfi, 'aarch64'),
          ]),
          lockedVersion: '5.2.37-r2',
        },
      ],
      lockFiles: ['apko.lock.json'],
    });
  });

  it('omits lockedVersion when archs disagree', async () => {
    fs.readLocalFile.mockResolvedValue(Fixtures.get('lock-disagree.json'));

    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: ['bash=5.2.37-r2'],
          archs: ['amd64', 'arm64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [
          wolfiX86,
          registryUrl(wolfi, 'aarch64'),
        ]),
      ],
      lockFiles: ['apko.lock.json'],
    });
  });

  it('does not add packages that appear only in the lock', async () => {
    fs.readLocalFile.mockResolvedValue(Fixtures.get('lock-transitive.json'));

    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: ['bash=5.2.37-r2'],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        {
          ...pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [wolfiX86]),
          lockedVersion: '5.2.37-r2',
        },
      ],
      lockFiles: ['apko.lock.json'],
    });
  });

  it('returns deps when the lock file is not valid JSON', async () => {
    fs.readLocalFile.mockResolvedValue('{');

    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: ['bash=5.2.37-r2'],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [wolfiX86])],
    });
  });

  it('reads image.lock.json next to image.yml', async () => {
    fs.readLocalFile.mockImplementation(
      (fileName: string): Promise<string | null> =>
        Promise.resolve(
          fileName === 'dir/image.lock.json'
            ? Fixtures.get('lock-agree.json')
            : null,
        ),
    );

    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: ['bash=5.2.37-r2'],
          archs: ['amd64'],
        }),
        'dir/image.yml',
      ),
    ).resolves.toEqual({
      deps: [
        {
          ...pin('bash=5.2.37-r2', 'bash', '5.2.37-r2', [wolfiX86]),
          lockedVersion: '5.2.37-r2',
        },
      ],
      lockFiles: ['dir/image.lock.json'],
    });
  });

  it('returns an unversioned package and its lock file', async () => {
    fs.readLocalFile.mockResolvedValue(Fixtures.get('lock-agree.json'));

    await expect(
      extractPackageFile(
        yaml({
          repositories: [wolfi],
          packages: ['wolfi-base'],
          archs: ['amd64'],
        }),
        'apko.yaml',
      ),
    ).resolves.toEqual({
      deps: [
        {
          datasource: 'apk',
          depName: 'wolfi-base',
          skipReason: 'unspecified-version',
        },
      ],
      lockFiles: ['apko.lock.json'],
    });
  });

  it('does not follow include', async () => {
    const child = Fixtures.get('include-child.yaml');
    fs.readLocalFile.mockImplementation(
      (fileName: string): Promise<string | null> => {
        if (
          fileName === 'pkgs/apko.yaml' ||
          fileName === 'app/pkgs/apko.yaml'
        ) {
          return Promise.resolve(child);
        }
        return Promise.resolve(null);
      },
    );

    await expect(
      extractPackageFile(Fixtures.get('include-parent.yaml'), 'app/apko.yaml'),
    ).resolves.toEqual({
      deps: [pin('curl=8.12.1-r0', 'curl', '8.12.1-r0', [wolfiX86])],
    });
  });

  it('skips an included file extracted alone when it has no repositories', async () => {
    await expect(
      extractPackageFile(Fixtures.get('include-child.yaml'), 'pkgs/apko.yaml'),
    ).resolves.toEqual({
      deps: [
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
          skipReason: 'unknown-registry',
        },
      ],
    });
  });
});
