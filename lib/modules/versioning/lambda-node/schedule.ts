import dataFiles from '../../../data-files.generated.ts';
import { regEx } from '../../../util/regex.ts';
import { isStable } from '../node/index.ts';
import type { LambdaData, LambdaSchedule } from './types.ts';

const lambdaSchedule: LambdaData = JSON.parse(
  dataFiles.get('data/lambda-node-js-schedule.json')!,
);

export function findLambdaScheduleForVersion(
  version: string,
): LambdaSchedule | null {
  const majorVersionMatch = regEx(/^v?([0-9]+)\./).exec(version);

  if (!majorVersionMatch) {
    return null;
  }

  if (!isStable(version)) {
    return null;
  }

  return lambdaSchedule[majorVersionMatch[1]] ?? null;
}
