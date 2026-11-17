import { GlobalConfig } from '../../config/global.ts';
import { exec } from './index.ts';

vi.unmock('./common.ts');

describe('util/exec/index.integration', () => {
  beforeEach(() => {
    GlobalConfig.set({ binarySource: 'global', localDir: process.cwd() });
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('delivers input only to the last process in a sequence', async () => {
    const input = 'private input';

    await expect(
      exec(
        [
          {
            command: [
              process.execPath,
              '-e',
              'process.stdin.resume(); process.stdin.on("end", () => process.stdout.write("setup"));',
            ],
          },
          {
            command: [
              process.execPath,
              '-e',
              'process.stdin.pipe(process.stdout);',
            ],
          },
        ],
        { input, redactOutput: true, timeout: 1000 },
      ),
    ).resolves.toEqual({ stdout: input, stderr: '' });
  });
});
