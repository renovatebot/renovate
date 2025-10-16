import { HatchProcessor } from './hatch';
import { PdmProcessor } from './pdm';
import type { PyProjectProcessor } from './types';
import { UvProcessor } from './uv';

export const processors: PyProjectProcessor[] = [
  new HatchProcessor(),
  new PdmProcessor(),
  new UvProcessor(),
];
