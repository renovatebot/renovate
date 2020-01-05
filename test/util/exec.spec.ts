import {
  exec as _cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { exec, ExecOptions } from '../../lib/util/exec';

const cpExec: jest.Mock<typeof _cpExec> = _cpExec as any;
jest.mock('child_process');

describe('exec()', () => {
  it('wraps original exec() from "child_process" module', async () => {
    const cases = [
      ['foo', {}, 'foo', { encoding: 'utf-8' }],
      [
        'foo',
        { docker: { image: 'bar' } },
        'docker run --rm bar foo',
        { encoding: 'utf-8' },
      ],
      [
        'foo',
        { docker: { image: 'bar', cmdWrap: 'su user -c {{ cmd }}' } },
        'docker run --rm bar su user -c foo',
        { encoding: 'utf-8' },
      ],
      [
        'foo',
        { docker: { image: 'bar', tag: 'latest' } },
        'docker run --rm bar:latest foo',
        { encoding: 'utf-8' },
      ],
      [
        'foo',
        { docker: { image: 'bar' }, cwd: '/current/working/directory' },
        'docker run --rm -w "/current/working/directory" bar foo',
        { encoding: 'utf-8', cwd: '/current/working/directory' },
      ],
      [
        'foo',
        {
          docker: { image: 'bar', dockerUser: 'baz' },
        },
        'docker run --rm --user=baz bar foo',
        { encoding: 'utf-8' },
      ],
      [
        'foo',
        {
          docker: { image: 'bar', volumes: ['/path/to/volume'] },
        },
        'docker run --rm -v "/path/to/volume":"/path/to/volume" bar foo',
        { encoding: 'utf-8' },
      ],
      [
        'foo',
        {
          docker: { image: 'bar', envVars: ['SOMETHING_SENSIBLE'] },
        },
        'docker run --rm -e SOMETHING_SENSIBLE bar foo',
        { encoding: 'utf-8' },
      ],
    ];
    for (const [cmd, opts, expectedCmd, expectedOpts] of cases) {
      let actualCmd: string | null = null;
      let actualOpts: ChildProcessExecOptions | null = null;
      cpExec.mockImplementationOnce((execCmd, execOpts, callback) => {
        actualCmd = execCmd;
        actualOpts = execOpts;
        callback(null, { stdout: '', stderr: '' });
        return undefined;
      });
      await exec(cmd as string, opts as ExecOptions);
      expect(actualCmd).toEqual(expectedCmd);
      expect(actualOpts).toEqual(expectedOpts);
    }
  });
});
