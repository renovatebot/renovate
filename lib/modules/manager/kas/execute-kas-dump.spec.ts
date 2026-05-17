import { mockExecAll } from '~test/exec-util.ts';
import { executeKasDump } from './extract.ts';

describe('modules/manager/kas/execute-kas-dump', () => {
  it('returns parsed KasDump on valid JSON stdout', async () => {
    const validDump = JSON.stringify({
      header: { version: 1 },
      repos: {
        isar: {
          url: 'https://github.com/ilbers/isar.git',
          commit: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        },
      },
    });
    mockExecAll({ stdout: validDump, stderr: '' });

    const result = await executeKasDump('kas-project.yml');

    expect(result).toMatchObject({
      header: { version: 1 },
      repos: {
        isar: {
          url: 'https://github.com/ilbers/isar.git',
          commit: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        },
      },
    });
  });

  it('passes correct command and options to exec', async () => {
    const validDump = JSON.stringify({ header: { version: 1 } });
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
      header: { version: 1 },
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
      header: { version: 1 },
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
