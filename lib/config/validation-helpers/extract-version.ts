import { regEx } from '../../util/regex';
import type { ValidationMessage } from '../types';

/**
 * Extracts named capture groups from a regex pattern.
 *
 * This function parses a regex pattern string and identifies all named capture groups
 * using the syntax (?<name>...). Named capture groups are essential for the extractVersion
 * feature as they define which parts of a version string can be extracted and used in
 * handlebars templates.
 *
 * @param pattern - The regex pattern string to parse (e.g., "^(?<version>\\d+\\.\\d+)")
 * @returns An array of capture group names found in the pattern
 *
 * @example
 * extractNamedGroupsFromRegex("^(?<version>\\d+)")
 * // returns ["version"]
 *
 * @example
 * extractNamedGroupsFromRegex("^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)")
 * // returns ["major", "minor", "patch"]
 *
 * @example
 * extractNamedGroupsFromRegex("^\\d+\\.\\d+")
 * // returns [] (no named groups)
 */
export function extractNamedGroupsFromRegex(pattern: string): string[] {
  const namedGroupRegex = regEx(/\(\?<(\w+)>/g);
  const groups: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = namedGroupRegex.exec(pattern)) !== null) {
    groups.push(match[1]);
  }

  return groups;
}

/**
 * Extracts variable names used in a handlebars template.
 *
 * This function identifies all variables referenced in a handlebars template string.
 * It supports common handlebars patterns used in extractVersion templates, including
 * simple variable interpolation and conditional blocks. The extracted variables are
 * then validated against the regex capture groups to ensure configuration correctness.
 *
 * Supported patterns:
 * - Simple variables: {{variable}}
 * - Conditional blocks: {{#if variable}} and {{#unless variable}}
 *
 * Limitations:
 * - Does not handle nested paths (e.g., {{foo.bar}})
 * - Does not handle dynamic lookups (e.g., {{lookup this "key"}})
 * - Does not handle helper functions with complex arguments
 *
 * @param template - The handlebars template string to parse
 * @returns An array of unique variable names found in the template
 *
 * @example
 * extractHandlebarsVariables("{{version}}")
 * // returns ["version"]
 *
 * @example
 * extractHandlebarsVariables("{{major}}.{{minor}}.{{patch}}")
 * // returns ["major", "minor", "patch"]
 *
 * @example
 * extractHandlebarsVariables("{{version}}{{#if prerelease}}-{{prerelease}}{{/if}}")
 * // returns ["version", "prerelease"]
 */
export function extractHandlebarsVariables(template: string): string[] {
  const variables = new Set<string>();

  // Match simple variables: {{variable}}
  const simpleVarRegex = regEx(/\{\{(\w+)\}\}/g);
  let match: RegExpExecArray | null;

  while ((match = simpleVarRegex.exec(template)) !== null) {
    variables.add(match[1]);
  }

  // Match variables in conditionals: {{#if variable}} or {{#unless variable}}
  const conditionalRegex = regEx(/\{\{#(?:if|unless)\s+(\w+)\}\}/g);
  while ((match = conditionalRegex.exec(template)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Validates that all variables used in a handlebars template are captured by the regex pattern's named groups.
 *
 * This is the main validation function that ensures extractVersion configurations are correct.
 * It helps prevent runtime errors by catching mismatches between regex capture groups and template
 * variables during configuration validation, providing clear warning messages to help users fix
 * their configuration before it causes issues.
 *
 * The validation only applies to the [regex, template] array format. Legacy string format and
 * single-element array format are not validated as they don't use templates.
 *
 * Validation process:
 * 1. Extract all named capture groups from the regex pattern
 * 2. Extract all variable references from the handlebars template
 * 3. Check if every template variable has a corresponding capture group
 * 4. Return a warning if any variables are missing, null if validation passes
 *
 * Note: This validation produces warnings rather than errors, as it's a proactive check to help
 * users catch configuration mistakes early without blocking the configuration from being processed.
 *
 * @param extractVersion - The extractVersion configuration value to validate
 * @param configPath - The configuration path for error reporting (e.g., "packageRules[0].extractVersion")
 * @returns A ValidationMessage (warning) if validation fails, null if validation passes or doesn't apply
 *
 * @example
 * // Valid configuration - returns null
 * validateExtractVersion(
 *   ['^(?<version>\\d+)', '{{version}}'],
 *   'extractVersion'
 * )
 *
 * @example
 * // Invalid configuration - returns error
 * validateExtractVersion(
 *   ['^(?<version>\\d+)', '{{major}}.{{minor}}'],
 *   'extractVersion'
 * )
 * // Returns: {
 * //   topic: 'Configuration Error',
 * //   message: 'Invalid extractVersion template at "extractVersion": template uses variables [major, minor] that are not captured by the regex pattern. Available capture groups: [version]'
 * // }
 *
 * @example
 * // Legacy format - returns null (not validated)
 * validateExtractVersion('^(?<version>\\d+)', 'extractVersion')
 */
export function validateExtractVersion(
  extractVersion: string | [string] | [string, string],
  configPath: string,
): ValidationMessage | null {
  // Only validate the [regex, template] format
  if (
    !Array.isArray(extractVersion) ||
    extractVersion.length !== 2 ||
    typeof extractVersion[0] !== 'string' ||
    typeof extractVersion[1] !== 'string'
  ) {
    return null;
  }

  const [regexPattern, template] = extractVersion;

  try {
    // Extract named groups from regex
    const namedGroups = extractNamedGroupsFromRegex(regexPattern);

    // Extract variables used in template
    const templateVariables = extractHandlebarsVariables(template);

    // Check if all template variables exist in named groups
    const missingVariables = templateVariables.filter(
      (variable) => !namedGroups.includes(variable),
    );

    if (missingVariables.length > 0) {
      return {
        topic: 'Configuration Warning',
        message: `Invalid extractVersion template at "${configPath}": template uses variables [${missingVariables.join(', ')}] that are not captured by the regex pattern. Available capture groups: [${namedGroups.join(', ') || 'none'}]`,
      };
    }
  } catch {
    // If we can't parse the regex or template, let it fail at runtime
    // This validation is best-effort
    return null;
  }

  return null;
}
