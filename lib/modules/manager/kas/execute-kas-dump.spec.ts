import { mockExecAll } from '~test/exec-util.ts';
import { executeKasDump } from './extract.ts';

describe('modules/manager/kas/execute-kas-dump', () => {
  it('returns parsed KasDump on valid JSON stdout', async () => {
    const validDump = JSON.stringify({
      header: { version: 22 },
      repos: {
        isar: {
          url: 'https://github.com/ilbers/isar.git',
          commit: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        },
      },
    });
    mockExecAll({ stdout: validDump, stderr: '' });

    const result = await executeKasDump('kas-project.yml');

    expect(result).toMatchObject({
      header: { version: 22 },
      repos: {
        isar: {
          url: 'https://github.com/ilbers/isar.git',
          commit: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        },
      },
    });
  });

  it('passes correct command and options to exec', async () => {
    const validDump = JSON.stringify({ header: { version: 22 } });
    const snapshots = mockExecAll({ stdout: validDump, stderr: '' });

    await executeKasDump('path/to/kas-project.yml');

    expect(snapshots).toMatchObject([
      {
        cmd: 'kas dump --format json path/to/kas-project.yml',
      },
    ]);
  });

  it('returns null when exec throws', async () => {
    mockExecAll(new Error('command not found: kas'));

    const result = await executeKasDump('kas-project.yml');

    expect(result).toBeNull();
  });

  it('returns null when stdout is not valid JSON', async () => {
    mockExecAll({ stdout: 'not json at all', stderr: '' });

    const result = await executeKasDump('kas-project.yml');

    expect(result).toBeNull();
  });

  it('returns null when stdout JSON does not match KasDump schema', async () => {
    const invalidDump = JSON.stringify({ unexpected: 'structure' });
    mockExecAll({ stdout: invalidDump, stderr: '' });

    const result = await executeKasDump('kas-project.yml');

    expect(result).toBeNull();
  });

  it('parses dump with repos and overrides', async () => {
    const dumpWithOverrides = JSON.stringify({
      header: { version: 22 },
      repos: {
        isar: {
          url: 'https://github.com/ilbers/isar.git',
          commit: 'aaa111',
          branch: 'main',
        },
      },
      overrides: {
        repos: {
          isar: { commit: 'bbb222' },
        },
      },
    });
    mockExecAll({ stdout: dumpWithOverrides, stderr: '' });

    const result = await executeKasDump('kas-project.yml');

    expect(result).toMatchObject({
      header: { version: 22 },
      repos: {
        isar: {
          url: 'https://github.com/ilbers/isar.git',
          commit: 'aaa111',
          branch: 'main',
        },
      },
      overrides: {
        repos: {
          isar: { commit: 'bbb222' },
        },
      },
    });
  });
});
