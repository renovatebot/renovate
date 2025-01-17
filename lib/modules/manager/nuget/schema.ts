import { z } from 'zod';
import { Jsonc } from '../../../util/schema-utils';

/**
 * The roll-forward policy to use when selecting an SDK version, either as a fallback when a specific SDK version is missing or as a directive to use a later version. A version must be specified with a rollForward value, unless you're setting it to latestMajor. The default roll forward behavior is determined by the matching rules.
 *
 * https://learn.microsoft.com/de-de/dotnet/core/tools/global-json#rollforward
 */
const RollForwardSchema = z.enum([
  'patch',
  'feature',
  'minor',
  'major',
  'latestPatch',
  'latestFeature',
  'latestMinor',
  'latestMajor',
  'disable',
]);
export type RollForward = z.infer<typeof RollForwardSchema>;

/**
 * global.json schema
 *
 * https://learn.microsoft.com/en-us/dotnet/core/tools/global-json#allowprerelease
 */
export const GlobalJsonSchema = z.object({
  /**
   * Specifies information about the .NET SDK to select.
   */
  sdk: z
    .object({
      /**
       * The version of the .NET SDK to use.
       *
       * https://learn.microsoft.com/de-de/dotnet/core/tools/global-json#version
       */
      version: z.string().optional(),
      /**
       * The roll-forward policy to use when selecting an SDK version, either as a fallback when a specific SDK version is missing or as a directive to use a later version. A version must be specified with a rollForward value, unless you're setting it to latestMajor. The default roll forward behavior is determined by the matching rules.
       *
       * https://learn.microsoft.com/de-de/dotnet/core/tools/global-json#rollforward
       */
      rollForward: RollForwardSchema.optional(),
      /**
       * Indicates whether the SDK resolver should consider prerelease versions when selecting the SDK version to use.
       *
       * https://learn.microsoft.com/de-de/dotnet/core/tools/global-json#allowprerelease
       */
      allowPrerelease: z.boolean().optional(),
    })
    .optional(),

  /**
   * Lets you control the project SDK version in one place rather than in each individual project. For more information, see How project SDKs are resolved.
   *
   * https://learn.microsoft.com/de-de/dotnet/core/tools/global-json#msbuild-sdks
   */
  'msbuild-sdks': z.record(z.string()).optional(),
});

export const GlobalJson = Jsonc.pipe(GlobalJsonSchema);
export type GlobalJson = z.infer<typeof GlobalJson>;
