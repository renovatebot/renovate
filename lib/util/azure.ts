/**
 * Azure Pipelines utility constants and helpers.
 *
 * @see https://learn.microsoft.com/azure/devops/pipelines/build/variables
 */
export const AzurePipelines = {
  /**
   * Azure Pipelines predefined environment variable key names.
   * Use with `process.env[AzurePipelines.PredefinedVariables.xxx]`.
   */
  PredefinedVariables: {
    /**
     * The URI of the Azure DevOps collection.
     * Set automatically by the Azure Pipelines agent.
     * Also available when running GitHub-hosted pipelines via the Azure Pipelines app.
     *
     * @example 'https://dev.azure.com/myorg/'
     * @see https://learn.microsoft.com/azure/devops/pipelines/build/variables#system-variables
     */
    systemCollectionUri: 'SYSTEM_COLLECTIONURI',
  },
} as const;
