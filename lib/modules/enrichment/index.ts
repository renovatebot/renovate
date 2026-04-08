import type { RenovateConfig } from '../../config/types.ts';
import { logger } from '../../logger/index.ts';
import type { PackageFile } from '../manager/types.ts';
import api from './api.ts';
import type {
  EnrichmentApi,
  EnrichmentRepositoryResult,
  EnrichmentResult,
  EnrichmentUpdateContext,
} from './types.ts';

export function getEnrichments(): Map<string, EnrichmentApi> {
  return api;
}

function getEnabledEnrichments(config: RenovateConfig): EnrichmentApi[] {
  return [...api.values()].filter((e) => e.isEnabled(config));
}

/**
 * Global initialization: called once at global worker start.
 * Calls init() on all enabled enrichment modules.
 */
export async function initEnrichments(config: RenovateConfig): Promise<void> {
  for (const enrichment of getEnabledEnrichments(config)) {
    if (enrichment.init) {
      logger.debug(`Initializing enrichment: ${enrichment.id}`);
      await enrichment.init(config);
    }
  }
}

/**
 * Per-repo initialization: called once per repository.
 * Calls initRepo() on all enabled enrichment modules.
 */
export async function initRepoEnrichments(
  config: RenovateConfig,
): Promise<void> {
  for (const enrichment of getEnabledEnrichments(config)) {
    if (enrichment.initRepo) {
      logger.debug(`Initializing enrichment for repo: ${enrichment.id}`);
      await enrichment.initRepo(config);
    }
  }
}

/**
 * Runs all enrichments that implement enrichRepository().
 * Collects PackageRules and appends them to config.
 */
export async function runRepositoryEnrichments(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
): Promise<void> {
  for (const enrichment of getEnabledEnrichments(config)) {
    if (enrichment.enrichRepository) {
      logger.debug(`Running repository enrichment: ${enrichment.id}`);
      const result = await enrichment.enrichRepository(config, packageFiles);
      applyRepositoryResult(config, result);
    }
  }
}

/**
 * Runs all enrichments that implement enrichUpdate().
 * Returns merged results from all enrichments.
 */
export async function runUpdateEnrichments(
  context: EnrichmentUpdateContext,
  config: RenovateConfig,
): Promise<EnrichmentResult> {
  const merged: EnrichmentResult = {};

  for (const enrichment of getEnabledEnrichments(config)) {
    if (enrichment.enrichUpdate) {
      const result = await enrichment.enrichUpdate(context, config);
      if (!result) {
        continue;
      }
      mergeResult(enrichment.id, merged, result);
    }
  }

  return merged;
}

function applyRepositoryResult(
  config: RenovateConfig,
  result: EnrichmentRepositoryResult,
): void {
  if (result.packageRules?.length) {
    config.packageRules ??= [];
    config.packageRules.push(...result.packageRules);
  }
}

function mergeResult(moduleId: string, target: EnrichmentResult, source: EnrichmentResult): void {
  console.log({ moduleId, source, target })
  if (source.metadata) {
    target.metadata = { ...target.metadata, ...source.metadata };
  }
  if (source.mergeConfidenceLevel !== undefined) {
    target.mergeConfidenceLevel = source.mergeConfidenceLevel
  }
  if (source.prBodyNotes) {
    target.prBodyNotes ??= [];
    target.prBodyNotes.push(...source.prBodyNotes);
  }
  if (source.statusCheck) {
    target.statusCheck = source.statusCheck;
  }
  if (source.skipReason && !target.skipReason) {
    target.skipReason = source.skipReason;
    target.skipReferences = source.skipReferences;
  }
  if (source.packageRules?.length) {
    target.packageRules ??= [];
    target.packageRules.push(...source.packageRules);
  }
}
