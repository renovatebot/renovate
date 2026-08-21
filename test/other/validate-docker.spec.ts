import fs from 'fs-extra';

describe('other/validate-docker', () => {
  it('validate dockerfile has consistent base image versions', async () => {
    const dockerfile = await fs.readFile('tools/docker/Dockerfile', 'utf8');
    expect(dockerfile).toBeString();
    expect(dockerfile).toContain('ghcr.io/renovatebot/base-image');

    const matches = dockerfile.matchAll(
      /ghcr\.io\/renovatebot\/base-image:(?<version>\d+\.\d+\.\d+)/g,
    );

    expect(matches).toBeDefined();

    const versions = [...matches].map((v) => v.groups?.version);

    expect(versions).toHaveLength(3);
    expect(new Set(versions)).toEqual(new Set(versions.slice(0, 1)));
  });
});
