import { UpdateType } from '../../config/types';
import { logger } from '../../logger';
import * as hostRules from '../host-rules';
import { Http } from '../http';

const http = new Http('merge-confidence');

const MERGE_CONFIDENCE = ['low', 'neutral', 'high', 'very high'];
type MergeConfidenceTuple = typeof MERGE_CONFIDENCE;
export type MergeConfidence = MergeConfidenceTuple[number];

export const confidenceLevels: Record<MergeConfidence, number> = {
  low: -1,
  neutral: 0,
  high: 1,
  'very high': 2,
};

export function isActiveConfidenceLevel(confidence: string): boolean {
  return confidence !== 'low' && MERGE_CONFIDENCE.includes(confidence);
}

export function satisfiesConfidenceLevel(
  confidence: MergeConfidence,
  minimumConfidence: MergeConfidence
): boolean {
  return confidenceLevels[confidence] >= confidenceLevels[minimumConfidence];
}

export async function getMergeConfidenceLevel(
  datasource: string,
  depName: string,
  currentVersion: string,
  newVersion: string,
  updateType: UpdateType
): Promise<MergeConfidence> {
  if (!(currentVersion && newVersion && updateType)) {
    return 'neutral';
  }
  const updateTypeConfidenceMapping: Record<UpdateType, MergeConfidence> = {
    pin: 'high',
    digest: 'neutral',
    bump: 'neutral',
    lockFileMaintenance: 'neutral',
    lockfileUpdate: 'neutral',
    rollback: 'neutral',
    major: null,
    minor: null,
    patch: null,
  };
  const mappedConfidence = updateTypeConfidenceMapping[updateType];
  if (mappedConfidence) {
    return mappedConfidence;
  }
  const { token } = hostRules.find({
    hostType: 'merge-confidence',
    url: 'https://badges.renovateapi.com',
  });
  if (!token) {
    logger.warn('No Merge Confidence API token found');
    return 'neutral';
  }
  try {
    const { confidence } = (
      await http.getJson<{ confidence: MergeConfidence }>(
        `https://badges.renovateapi.com/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
      )
    ).body;
    if (MERGE_CONFIDENCE.includes(confidence)) {
      return confidence;
    }
  } catch (err) {
    logger.debug({ err }, 'Error fetching merge confidence');
    if (err.statusCode === 403) {
      logger.warn('Merge Confidence API token rejected');
    }
  }
  return 'neutral';
}
