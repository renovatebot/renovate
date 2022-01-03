import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../logger';
import { readLocalFile } from '../../util/fs';
import { regEx } from '../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { GitlabPipeline } from './types';
import { replaceReferenceTags } from './utils';

const commentsRe = regEx(/^\s*#/);
const whitespaceRe = regEx(`^(?<whitespace>\\s*)`);
const imageRe = regEx(
  `^(?<whitespace>\\s*)image:(?:\\s+['"]?(?<image>[^\\s'"]+)['"]?)?\\s*$`
);
const nameRe = regEx(`^\\s*name:\\s+['"]?(?<depName>[^\\s'"]+)['"]?\\s*$`);
const serviceRe = regEx(
  `^\\s*-\\s*(?:name:\\s+)?['"]?(?<depName>[^\\s'"]+)['"]?\\s*$`
);
function skipCommentLines(
  lines: string[],
  lineNumber: number
): { lineNumber: number; line: string } {
  let ln = lineNumber;
  while (ln < lines.length - 1 && commentsRe.test(lines[ln])) {
    ln += 1;
  }
  return { line: lines[ln], lineNumber: ln };
}

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const imageMatch = imageRe.exec(line);
      if (imageMatch) {
        switch (imageMatch.groups.image) {
          case undefined:
          case '': {
            let blockLine;
            do {
              lineNumber += 1;
              blockLine = lines[lineNumber];
              const imageNameMatch = nameRe.exec(blockLine);
              if (imageNameMatch) {
                logger.trace(`Matched image name on line ${lineNumber}`);
                const dep = getDep(imageNameMatch.groups.depName);
                dep.depType = 'image-name';
                deps.push(dep);
                break;
              }
            } while (
              whitespaceRe.exec(blockLine)?.groups.whitespace.length >
              imageMatch.groups.whitespace.length
            );
            break;
          }
          default: {
            logger.trace(`Matched image on line ${lineNumber}`);
            const dep = getDep(imageMatch.groups.image);
            dep.depType = 'image';
            deps.push(dep);
          }
        }
      }
      const services = regEx(/^\s*services:\s*$/).test(line);
      if (services) {
        logger.trace(`Matched services on line ${lineNumber}`);
        let foundImage: boolean;
        do {
          foundImage = false;
          const serviceImageLine = skipCommentLines(lines, lineNumber + 1);
          logger.trace(`serviceImageLine: "${serviceImageLine.line}"`);
          const serviceImageMatch = serviceRe.exec(serviceImageLine.line);
          if (serviceImageMatch) {
            logger.trace('serviceImageMatch');
            foundImage = true;
            lineNumber = serviceImageLine.lineNumber;
            const dep = getDep(serviceImageMatch.groups.depName);
            dep.depType = 'service-image';
            deps.push(dep);
          }
        } while (foundImage);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting GitLab CI dependencies');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const filesToExamine = [...packageFiles];
  const seen = new Set<string>(packageFiles);
  const results: PackageFile[] = [];

  // extract all includes from the files
  while (filesToExamine.length > 0) {
    const file = filesToExamine.pop();

    const content = await readLocalFile(file, 'utf8');
    if (!content) {
      logger.debug({ file }, 'Empty or non existent gitlabci file');

      continue;
    }
    let doc: GitlabPipeline;
    try {
      doc = load(replaceReferenceTags(content), {
        json: true,
      }) as GitlabPipeline;
    } catch (err) {
      logger.warn({ err, file }, 'Error extracting GitLab CI dependencies');
    }

    if (is.array(doc?.include)) {
      for (const includeObj of doc.include) {
        if (is.string(includeObj.local)) {
          const fileObj = includeObj.local.replace(regEx(/^\//), '');
          if (!seen.has(fileObj)) {
            seen.add(fileObj);
            filesToExamine.push(fileObj);
          }
        }
      }
    } else if (is.string(doc?.include)) {
      const fileObj = doc.include.replace(regEx(/^\//), '');
      if (!seen.has(fileObj)) {
        seen.add(fileObj);
        filesToExamine.push(fileObj);
      }
    }

    const result = extractPackageFile(content);
    if (result !== null) {
      results.push({
        packageFile: file,
        deps: result.deps,
      });
    }
  }

  logger.trace(
    { packageFiles, files: filesToExamine.entries() },
    'extracted all GitLab CI files'
  );

  if (!results.length) {
    return null;
  }

  return results;
}
