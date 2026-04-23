import type { RenovateOptions } from '../types.ts';

export function getUndocumentedOptions(): Readonly<RenovateOptions>[] {
  return options;
}

const options: Readonly<RenovateOptions>[] = [
  {
    name: 'minimumConfidence',
    description:
      'Minimum Merge confidence level to filter by. Requires authentication to work.',
    type: 'string',
    allowedValues: ['low', 'neutral', 'high', 'very high'],
    default: 'low',
    experimental: true,
    undocumented: true,
  },
];
