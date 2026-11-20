import { getConfig } from '../../../lib/config/defaults.ts';
import { githubActionsLockfile } from './github-actions-lockfile.ts';

const cliVersion = getConfig().constraints?.ghActionsLock;
const cliRoot = `https://raw.githubusercontent.com/github/gh-actions-lock/${cliVersion}`;
const moduleRoot =
  'https://raw.githubusercontent.com/github/actions-lockfile/go/v0.0.6';

const goMod = `
module github.com/github/gh-actions-lock

require github.com/github/actions-lockfile/go v0.0.6
`;

const schemaSource = `
func Schema() string {
  return schemaV003
}

func SchemaForVersion(version string) (string, bool) {
  switch version {
  case "v0.0.1":
    return schemaV001, true
  case "v0.0.2":
    return schemaV002, true
  case "v0.0.3":
    return schemaV003, true
  default:
    return "", false
  }
}
`;

function schema(version: string): string {
  return JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://gh.io/actions-lockfile/${version}.json`,
    type: 'object',
    additionalProperties: false,
    required: ['version'],
    properties: {
      version: { const: version },
      workflows: {
        type: 'object',
        additionalProperties: {
          type: 'array',
          items: { $ref: '#/$defs/pin' },
        },
      },
    },
  });
}

function mockResponses(responses: Record<string, string>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const body = responses[url];
      return Promise.resolve(
        new Response(body, { status: body === undefined ? 404 : 200 }),
      );
    }),
  );
}

describe('tools/static-data/sources/github-actions-lockfile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows the pinned CLI through its module to every supported schema', async () => {
    mockResponses({
      [`${cliRoot}/go.mod`]: goMod,
      [`${moduleRoot}/go/pkg/lockfile/schema.go`]: schemaSource,
      [`${moduleRoot}/schema/lockfile-v0.0.1.json`]: schema('v0.0.1'),
      [`${moduleRoot}/schema/lockfile-v0.0.2.json`]: schema('v0.0.2'),
      [`${moduleRoot}/schema/lockfile-v0.0.3.json`]: schema('v0.0.3'),
    });

    const raw = await githubActionsLockfile.fetch();
    const data = githubActionsLockfile.generate(raw);

    expect(data.versions).toEqual({
      cli: cliVersion,
      module: 'v0.0.6',
      schema: 'v0.0.3',
    });
    expect(Object.keys(data.schemas)).toEqual(['v0.0.1', 'v0.0.2', 'v0.0.3']);
    expect(githubActionsLockfile.commitMessage(undefined, data)).toEqual({
      subject: 'update GitHub Actions lockfile schema to v0.0.3',
    });
  });

  it('fails when the CLI does not pin the module', async () => {
    mockResponses({ [`${cliRoot}/go.mod`]: 'module example.com/invalid' });

    await expect(githubActionsLockfile.fetch()).rejects.toThrow(
      'Could not find github.com/github/actions-lockfile/go version',
    );
  });

  it('fails when the module does not declare its current schema', async () => {
    mockResponses({
      [`${cliRoot}/go.mod`]: goMod,
      [`${moduleRoot}/go/pkg/lockfile/schema.go`]: 'package lockfile',
    });

    await expect(githubActionsLockfile.fetch()).rejects.toThrow(
      'Could not find current schema',
    );
  });

  it('fails when the current schema is not supported by the reader', async () => {
    mockResponses({
      [`${cliRoot}/go.mod`]: goMod,
      [`${moduleRoot}/go/pkg/lockfile/schema.go`]: schemaSource.replace(
        'return schemaV003',
        'return schemaV999',
      ),
    });

    await expect(githubActionsLockfile.fetch()).rejects.toThrow(
      'Could not resolve current schema schemaV999',
    );
  });
});
