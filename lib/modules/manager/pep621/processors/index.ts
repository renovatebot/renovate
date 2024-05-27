import { HatchProcessor } from './hatch';
import { PdmProcessor } from './pdm';
import { RyeProcessor } from './rye';

export const processors = [
  new HatchProcessor(),
  new PdmProcessor(),
  new RyeProcessor(),
];
