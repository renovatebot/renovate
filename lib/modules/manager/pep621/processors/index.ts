import { HatchProcessor } from './hatch';
import { PdmProcessor } from './pdm';
import { UvProcessor } from './uv';

export const processors = [
  new HatchProcessor(),
  new PdmProcessor(),
  new UvProcessor(),
];
