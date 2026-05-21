import { XmlDocument, type XmlElement } from 'xmldoc';
import { z } from 'zod/v3';

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

class XmlWriter {
  private lines: string[] = [];
  private level: number;

  constructor(level = 0) {
    this.level = level;
  }

  value(name: string, value: string | undefined): void {
    if (value === undefined) {
      return;
    }

    this.lines.push(`${this.indent()}<${name}>${escapeXml(value)}</${name}>`);
  }

  node(name: string, renderChildren: (xml: XmlWriter) => void): void {
    this.renderNode(name, renderChildren, false);
  }

  nodeOrEmpty(name: string, renderChildren: (xml: XmlWriter) => void): void {
    this.renderNode(name, renderChildren, true);
  }

  hasContent(): boolean {
    return this.lines.length > 0;
  }

  toString(): string {
    return this.lines.join('\n');
  }

  private renderNode(
    name: string,
    renderChildren: (xml: XmlWriter) => void,
    preserveEmpty: boolean,
  ): void {
    const contentStart = this.lines.length;
    this.level += 1;
    renderChildren(this);
    this.level -= 1;

    const content = this.lines.splice(contentStart);

    if (!content.length) {
      if (preserveEmpty) {
        this.lines.push(`${this.indent()}<${name} />`);
      }

      return;
    }

    this.lines.push(
      `${this.indent()}<${name}>`,
      ...content,
      `${this.indent()}</${name}>`,
    );
  }

  private indent(): string {
    return '  '.repeat(this.level);
  }
}

function shrinkToUsefulSize(original: string, trimmed: string): string {
  if (trimmed.length >= original.length) {
    return original;
  }

  return trimmed;
}

function renderRelocationNode(
  xml: XmlWriter,
  relocation: XmlElement | undefined,
): void {
  if (!relocation) {
    return;
  }

  xml.nodeOrEmpty('relocation', () => {
    xml.value('groupId', relocation.valueWithPath('groupId'));
    xml.value('artifactId', relocation.valueWithPath('artifactId'));
    xml.value('version', relocation.valueWithPath('version'));
    xml.value('message', relocation.valueWithPath('message'));
  });
}

function trimMetadataXml(metadata: XmlDocument, input: string): string {
  const version = metadata.descendantWithPath('version')?.val;
  const latest = metadata.descendantWithPath('versioning.latest')?.val;
  const release = metadata.descendantWithPath('versioning.release')?.val;
  const versions =
    metadata
      .descendantWithPath('versioning.versions')
      ?.childrenNamed('version')
      .map((child) => child.val) ?? [];
  const snapshot = metadata.descendantWithPath('versioning.snapshot');
  const timestamp = snapshot?.childNamed('timestamp')?.val;
  const buildNumber = snapshot?.childNamed('buildNumber')?.val;

  const xml = new XmlWriter();
  xml.node('metadata', () => {
    xml.value('version', version);
    xml.node('versioning', () => {
      xml.value('latest', latest);
      xml.value('release', release);
      xml.node('versions', () => {
        for (const trimmedVersion of versions) {
          xml.value('version', trimmedVersion);
        }
      });
      xml.node('snapshot', () => {
        xml.value('timestamp', timestamp);
        xml.value('buildNumber', buildNumber);
      });
    });
  });

  if (!xml.hasContent()) {
    return input;
  }

  return shrinkToUsefulSize(input, [xmlHeader, xml.toString()].join('\n'));
}

function trimPomXml(project: XmlDocument, input: string): string {
  const homepage = project.valueWithPath('url');
  const sourceUrl = project.valueWithPath('scm.url');
  const groupId = project.valueWithPath('groupId');
  const relocation = project.descendantWithPath(
    'distributionManagement.relocation',
  );
  const parent = project.childNamed('parent');

  const xml = new XmlWriter();
  xml.node('project', () => {
    xml.value('groupId', groupId);
    xml.value('url', homepage);
    xml.node('scm', () => {
      xml.value('url', sourceUrl);
    });
    xml.node('distributionManagement', () => {
      renderRelocationNode(xml, relocation);
    });
    xml.node('parent', () => {
      xml.value('groupId', parent?.valueWithPath('groupId'));
      xml.value('artifactId', parent?.valueWithPath('artifactId'));
      xml.value('version', parent?.valueWithPath('version'));
    });
  });

  if (!xml.hasContent()) {
    return input;
  }

  return shrinkToUsefulSize(input, [xmlHeader, xml.toString()].join('\n'));
}

export function trimMavenXml(input: string): string {
  let parsed: XmlDocument;
  try {
    parsed = new XmlDocument(input);
  } catch {
    return input;
  }

  if (parsed.name.includes(':')) {
    return input;
  }

  switch (parsed.name) {
    case 'metadata':
      return trimMetadataXml(parsed, input);
    case 'project':
      return trimPomXml(parsed, input);
    default:
      return input;
  }
}

export const CachedMavenXml = z.string().transform(trimMavenXml);
