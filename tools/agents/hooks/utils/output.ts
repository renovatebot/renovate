import type { BlockOutput } from './schemas.ts';

export function block(reason: string): void {
  const output: BlockOutput = { decision: 'block', reason };
  console.log(JSON.stringify(output));
}
