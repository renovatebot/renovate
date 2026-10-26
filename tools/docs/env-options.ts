import { getEnvOptionsMap } from '../../lib/config/options/env-options.ts';
import { prettier } from '../../lib/expose.ts';
import { updateFile } from '../utils/index.ts';

export async function generateEnvOptions(dist: string): Promise<void> {
  const map = getEnvOptionsMap();

  const config = await prettier().format(JSON.stringify(map), {
    filepath: 'renovate-env-options.json',
  });

  await updateFile(`${dist}/renovate-env-options.json`, `${config}\n`);
}
