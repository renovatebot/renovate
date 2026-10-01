import type { XmlElement } from 'xmldoc';
import type { MavenXmlPath } from './types.ts';

export function getXmlPaths(root: XmlElement): Map<number, MavenXmlPath[]> {
  const paths = new Map<number, MavenXmlPath[]>();

  function visit(node: XmlElement, path: MavenXmlPath[]): void {
    paths.set(node.position!, path);
    const counts = new Map<string, number>();
    node.eachChild((child) => {
      const index = counts.get(child.name) ?? 0;
      counts.set(child.name, index + 1);
      visit(child, [...path, { name: child.name, index }]);
    });
  }

  visit(root, [{ name: root.name, index: 0 }]);
  return paths;
}

export function resolveXmlPath(
  root: XmlElement,
  path: MavenXmlPath[],
): XmlElement | null {
  if (path[0]?.name !== root.name || path[0].index !== 0) {
    return null;
  }
  let node = root;
  for (const { name, index } of path.slice(1)) {
    const child = node.childrenNamed(name)[index];
    if (!child) {
      return null;
    }
    node = child;
  }
  return node;
}
