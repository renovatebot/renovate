import dataFiles from '../../../data-files.generated';
import { regEx } from '../../../util/regex';
import { isStable } from '../node';

interface LambdaSchedule {
  cycle: string;

  /**
   * Either `true` if currently in support or a string indicating the date at which support will end
   */
  support: true | string;
}

export type LambdaData = Record<string, LambdaSchedule>;

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
