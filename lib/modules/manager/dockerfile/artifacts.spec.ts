import * as datasource from '../../datasource/index.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../datasource/index.ts', async () => {
  const actual = await vi.importActual<typeof datasource>(
    '../../datasource/index.ts',
  );
  return {
    ...actual,
    getDigest: vi.fn(),
  };
});

const getDigest = vi.mocked(datasource.getDigest);

const oldDigest = `sha256:${'1'.repeat(64)}`;
const newDigest = `sha256:${'2'.repeat(64)}`;

const config = {};

const interpolated = [
  'ARG NODE_VERSION=20',
  'ARG ALPINE_VERSION=3.19',
  `FROM node:\${NODE_VERSION}-alpine\${ALPINE_VERSION}@${oldDigest} AS base`,
  '',
].join('\n');

function run(newPackageFileContent: string) {
  return updateArtifacts({
    packageFileName: 'Dockerfile',
    updatedDeps: [],
    newPackageFileContent,
    config,
  });
}

describe('modules/manager/dockerfile/artifacts', () => {
  describe('updateArtifacts()', () => {
    it('re-pins the digest of an interpolated FROM image', async () => {
      getDigest.mockResolvedValueOnce(newDigest);

      const res = await run(interpolated);

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'Dockerfile',
            contents: interpolated.replace(oldDigest, newDigest),
          },
        },
      ]);
      expect(getDigest).toHaveBeenCalledWith(
        { datasource: 'docker', packageName: 'node', registryUrls: undefined },
        '20-alpine3.19',
      );
    });

    it('returns null when there are no deps', async () => {
      const res = await run('# no deps here\n');
      expect(res).toBeNull();
      expect(getDigest).not.toHaveBeenCalled();
    });

    it('skips a literal FROM image', async () => {
      const res = await run(`FROM node:20@${oldDigest}\n`);
      expect(res).toBeNull();
      expect(getDigest).not.toHaveBeenCalled();
    });

    it('skips an interpolated FROM image without a digest', async () => {
      const res = await run(
        'ARG NODE_VERSION=20\nFROM node:${NODE_VERSION}-alpine\n',
      );
      expect(res).toBeNull();
      expect(getDigest).not.toHaveBeenCalled();
    });

    it('skips a FROM image with an unresolvable variable', async () => {
      const res = await run(
        `ARG REGISTRY\nFROM \${REGISTRY}/node@${oldDigest}\n`,
      );
      expect(res).toBeNull();
      expect(getDigest).not.toHaveBeenCalled();
    });

    it('returns null when the digest is unchanged', async () => {
      getDigest.mockResolvedValueOnce(oldDigest);
      const res = await run(interpolated);
      expect(res).toBeNull();
    });

    it('returns null when no digest is resolved', async () => {
      getDigest.mockResolvedValueOnce(null);
      const res = await run(interpolated);
      expect(res).toBeNull();
    });

    it('returns an artifact error when digest resolution fails', async () => {
      getDigest.mockRejectedValueOnce(new Error('lookup failed'));
      const res = await run(interpolated);
      expect(res).toEqual([
        {
          artifactError: {
            fileName: 'Dockerfile',
            stderr: 'Failed to resolve digest for node:20-alpine3.19',
          },
        },
      ]);
    });
  });
});
