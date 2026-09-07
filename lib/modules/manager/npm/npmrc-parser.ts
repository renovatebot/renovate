import { isString } from '@sindresorhus/is';
import ini from 'ini';
import { regEx } from '../../../util/regex.ts';
import type {
  DetectedNpmrcLineEnding,
  NpmrcDocument,
  NpmrcLine,
  NpmrcLineEnding,
} from './types.ts';

/**
 * Follow `ini.parse`: indented section-like lines are settings, not sections.
 */
const npmrcSectionRegex = regEx(/^\[(?<section>[^\]]*)\]\s*$/);
const npmrcSettingRegex = regEx(/^(?<key>[^=]+)(?:=(?<value>.*))?$/);

/**
 * Reuse `ini.parse`'s token decoder while retaining raw lines for lossless
 * rendering.
 *
 * `@types/ini` declares a string result, but single-quoted JSON literals can
 * decode to other types, so callers must narrow it.
 */
function decodeNpmrcText(raw: string): unknown {
  return ini.unsafe(raw);
}

function decodeNpmrcValue(raw: string): unknown {
  const value = decodeNpmrcText(raw);
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (value === 'null') {
    return null;
  }
  return value;
}

function parseNpmrcKey(decodedKey: string): {
  key: string;
  isArray: boolean;
} {
  if (!decodedKey.endsWith('[]')) {
    return { key: decodedKey, isArray: false };
  }

  if (decodedKey === '[]') {
    return { key: decodedKey, isArray: false };
  }

  return { key: decodedKey.slice(0, -2), isArray: true };
}

function parseNpmrcLine(
  raw: string,
  lineEnding: NpmrcLineEnding,
  section: string | null,
): NpmrcLine {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
    return { type: 'other', raw, lineEnding };
  }

  const rawSectionName = npmrcSectionRegex.exec(raw)?.groups?.section;
  if (rawSectionName !== undefined) {
    const sectionName = decodeNpmrcText(rawSectionName);
    if (!isString(sectionName)) {
      return { type: 'other', raw, lineEnding };
    }

    return {
      type: 'section',
      name: sectionName,
      raw,
      lineEnding,
    };
  }

  const setting = npmrcSettingRegex.exec(raw)?.groups;
  if (!setting) {
    return { type: 'other', raw, lineEnding };
  }

  const decodedKey = decodeNpmrcText(setting.key);
  if (!isString(decodedKey)) {
    return { type: 'other', raw, lineEnding };
  }

  const { key, isArray } = parseNpmrcKey(decodedKey);

  let value: unknown = true;
  if (setting.value !== undefined) {
    value = decodeNpmrcValue(setting.value);
  }

  return {
    type: 'setting',
    section,
    key,
    isArray,
    value,
    raw,
    lineEnding,
  };
}

export function parseNpmrc(content: string): NpmrcDocument {
  const lines: NpmrcLine[] = [];
  let detectedLineEnding: DetectedNpmrcLineEnding | null = null;
  let section: string | null = null;
  // oxlint-disable-next-line prefer-named-capture-group -- split needs captured separators, not named groups.
  const parts = content.split(regEx(/(\r\n|\r|\n)/));

  for (let index = 0; index < parts.length; index += 2) {
    const raw = parts[index];
    const lineEnding = (parts[index + 1] ?? '') as NpmrcLineEnding;
    if (!raw && !lineEnding) {
      continue;
    }

    if (lineEnding && !detectedLineEnding) {
      detectedLineEnding = lineEnding;
    }

    const line = parseNpmrcLine(raw, lineEnding, section);
    lines.push(line);
    if (line.type === 'section') {
      section = line.name;
    }
  }

  return {
    lines,
    detectedLineEnding,
    trailingLineEnding: lines.at(-1)?.lineEnding ?? '',
  };
}

export function renderNpmrc(lines: NpmrcLine[]): string {
  return lines.map((line) => `${line.raw}${line.lineEnding}`).join('');
}
