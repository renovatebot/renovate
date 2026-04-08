import type { RenovateConfig } from '../../config/types.ts';
import { instrument } from '../../instrumentation/index.ts';
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
 * Calls init() on all enrichment modules.
 */
export async function initEnrichments(config: RenovateConfig): Promise<void> {
  await instrument('initEnrichments', async () => {
    for (const [, enrichment] of getEnrichments()) {
      if (enrichment.init) {
        logger.debug(
          { moduleId: enrichment.id },
          `Initializing enrichment: ${enrichment.id}`,
        );
        await instrument(
          `init ${enrichment.id}`,
          async () => await enrichment.init!(config),
        );
      }
    }
  });
}

/**
 * Per-repo initialization: called once per repository.
 * Calls initRepo() on all enabled enrichment modules.
 */
export async function initRepoEnrichments(
  config: RenovateConfig,
): Promise<void> {
  await instrument('initEnrichments', async () => {
    for (const [, enrichment] of getEnrichments()) {
      if (enrichment.initRepo) {
        logger.debug(
          { moduleId: enrichment.id },
          `Initializing enrichment for repo: ${enrichment.id}`,
        );
        await instrument(
          `initRepo ${enrichment.id}`,
          async () => await enrichment.initRepo!(config),
        );
      }
    }
  });
}

/**
 * Runs all enrichments that implement enrichRepository().
 * Collects PackageRules and appends them to config.
 */
export async function runRepositoryEnrichments(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
): Promise<void> {
  await instrument('runRepositoryEnrichments', async () => {
    for (const enrichment of getEnabledEnrichments(config)) {
      if (enrichment.enrichRepository) {
        logger.debug(
          { moduleId: enrichment.id },
          `Running repository enrichment: ${enrichment.id}`,
        );
        const result = await instrument(
          `enrichRepository ${enrichment.id}`,
          async () => await enrichment.enrichRepository!(config, packageFiles),
        );
        logger.debug(
          { moduleId: enrichment.id, result },
          `Enriched repository using ${enrichment.id}`,
        );
        applyRepositoryResult(config, result);
      }
    }
  });
}

/**
 * Runs all enrichments that implement enrichUpdate().
 * Returns merged results from all enrichments.
 */
export async function runUpdateEnrichments(
  context: EnrichmentUpdateContext,
  config: RenovateConfig,
): Promise<EnrichmentResult> {
  return await instrument('runUpdateEnrichments', async () => {
    const merged: EnrichmentResult = {};

    for (const enrichment of getEnabledEnrichments(config)) {
      if (enrichment.enrichUpdate) {
        const result = await instrument(
          `enrichUpdate ${enrichment.id}`,
          async () => await enrichment.enrichUpdate!(context, config),
        );
        if (!result) {
          logger.debug(
            { moduleId: enrichment.id, result, context },
            `No enrichment update found by ${enrichment.id}`,
          );
          continue;
        }
        logger.debug(
          { moduleId: enrichment.id, result, context },
          `Enriched update using ${enrichment.id}`,
        );
        mergeResult(enrichment.id, merged, result);
      }
    }

    return merged;
  });
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

/**
 * Merge `EnrichmentResult`s from source -> target
 */
function mergeResult(
  moduleId: string,
  target: EnrichmentResult,
  source: EnrichmentResult,
): void {
  logger.trace(
    { moduleId, source, target: { ...target } },
    `Merging EnrichmentResult for module '${moduleId}'`,
  );
  if (source.metadata) {
    target.metadata = { ...target.metadata, ...source.metadata };
  }
  if (source.mergeConfidenceLevel !== undefined) {
    target.mergeConfidenceLevel = source.mergeConfidenceLevel;
  }
  if (source.prBodyNotes) {
    target.prBodyNotes ??= [];
    target.prBodyNotes.push(...source.prBodyNotes);
  }
  if (source.statusChecks) {
    target.statusChecks = source.statusChecks;
  }
  if (source.skipReason) {
    if (
      target.skipReason !== undefined &&
      target.skipReason !== source.skipReason
    ) {
      logger.debug(
        { moduleId, source, target: { ...target } },
        `Overwriting previously set \`skipReason\` from module '${moduleId}'`,
      );
    }
    target.skipReason = source.skipReason;
    target.skipReferences = source.skipReferences;
  }
  if (source.packageRules?.length) {
    target.packageRules ??= [];
    target.packageRules.push(...source.packageRules);
  }
}
