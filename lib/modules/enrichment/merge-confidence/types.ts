export const MERGE_CONFIDENCE = [
  'low',
  'neutral',
  'high',
  'very high',
] as const;

export type MergeConfidence = (typeof MERGE_CONFIDENCE)[number];
