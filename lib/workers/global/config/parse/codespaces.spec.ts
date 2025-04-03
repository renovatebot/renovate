import readline from 'node:readline';
import type { Interface } from 'node:readline/promises';
import { partial } from '../../../../../test/util';
import { setConfig } from './codespaces';

describe('workers/global/config/parse/codespaces', () => {
  beforeEach(() => {
    process.env = {};
  });

  it('skips if codespace is not configured', async () => {
    expect(await setConfig({})).toMatchObject({});
  });

  it('passes GITHUB_TOKEN to config', async () => {
    process.env.GITHUB_TOKEN = 'token';
    process.env.CODESPACES = 'true';
    expect(await setConfig({ repositories: ['repo'] })).toMatchObject({
      repositories: ['repo'],
      token: 'token',
    });
  });

  it('passes repo to config after user input', async () => {
    process.env.CODESPACES = 'true';
    vitest.spyOn(readline.promises, 'createInterface').mockReturnValue(
      partial<Interface>({
        question: vitest.fn().mockResolvedValue('repo'),
        close: vitest.fn(),
      }),
    );

    expect(await setConfig({})).toMatchObject({
      repositories: ['repo'],
    });
  });
});
