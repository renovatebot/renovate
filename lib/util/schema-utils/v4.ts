import JSON5 from 'json5';
import { z } from 'zod/v4';
import { parseJsonc } from '../common';
import { parse as parseToml } from '../toml';
import { parseSingleYaml, parseYaml } from '../yaml';

export const Json = z.string().transform((str, ctx): unknown => {
  try {
    return JSON.parse(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSON' });
    return z.NEVER;
  }
});

export const Json5 = z.string().transform((str, ctx): unknown => {
  try {
    return JSON5.parse(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSON5' });
    return z.NEVER;
  }
});

export const Jsonc = z.string().transform((str, ctx): unknown => {
  try {
    return parseJsonc(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSONC' });
    return z.NEVER;
  }
});

export const Yaml = z.string().transform((str, ctx): unknown => {
  try {
    return parseSingleYaml(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid YAML' });
    return z.NEVER;
  }
});

export const MultidocYaml = z.string().transform((str, ctx): unknown => {
  try {
    return parseYaml(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid YAML' });
    return z.NEVER;
  }
});

export const Toml = z.string().transform((str, ctx) => {
  try {
    return parseToml(str);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid TOML' });
    return z.NEVER;
  }
});
