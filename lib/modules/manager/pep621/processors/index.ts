import { HatchProcessor } from './hatch.ts';
import { PdmProcessor } from './pdm.ts';
import type { PyProjectProcessor } from './types.ts';
import { UvProcessor } from './uv.ts';

export const processors: PyProjectProcessor[] = [
  new HatchProcessor(),
  new PdmProcessor(),
  new UvProcessor(),
];
