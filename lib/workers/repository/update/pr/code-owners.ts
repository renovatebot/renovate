import is from '@sindresorhus/is';
import ignore from 'ignore';
import { logger } from '../../../../logger';
import type { FileOwnerRule, Pr } from '../../../../modules/platform';
import { platform } from '../../../../modules/platform';
import { readLocalFile } from '../../../../util/fs';
import { getBranchFiles } from '../../../../util/git';
import { newlineRegex, regEx } from '../../../../util/regex';

interface FileOwnersScore {
  file: string;
  userScoreMap: Map<string, number>;
}

function extractOwnersFromLine(line: string): FileOwnerRule {
  const [pattern, ...usernames] = line.split(regEx(/\s+/));
  const matchPattern = ignore().add(pattern);
  return {
    usernames,
    pattern,
    score: pattern.length,
    match: (path: string) => matchPattern.ignores(path),
  };
}

function matchFileToOwners(
  file: string,
  rules: FileOwnerRule[],
): FileOwnersScore {
  const usernames = new Map<string, number>();

  for (const rule of rules) {
    if (!rule.match(file)) {
      continue;
    }

    for (const user of rule.usernames) {
      usernames.set(user, rule.score);
    }
  }

  return { file, userScoreMap: usernames };
}

interface OwnerFileScore {
  username: string;
  fileScoreMap: Map<string, number>;
}

function getOwnerList(filesWithOwners: FileOwnersScore[]): OwnerFileScore[] {
  const userFileMap = new Map<string, Map<string, number>>();

  for (const fileName of filesWithOwners) {
    for (const [username, score] of fileName.userScoreMap.entries()) {
      // Get / create user file score
      const fileMap = userFileMap.get(username) ?? new Map<string, number>();
      if (!userFileMap.has(username)) {
        userFileMap.set(username, fileMap);
      }

      // Add file to user
      fileMap.set(fileName.file, (fileMap.get(fileName.file) ?? 0) + score);
    }
  }

  return Array.from(userFileMap.entries()).map(([key, value]) => ({
    username: key,
    fileScoreMap: value,
  }));
}

function parseCodeOwnersContent(codeOwnersFile: string): string[] {
  return (
    codeOwnersFile
      .split(newlineRegex)
      // Remove comments
      .map((line) => line.split('#')[0])
      // Remove empty lines
      .map((line) => line.trim())
      .filter(is.nonEmptyString)
  );
}

export async function codeOwnersForPr(pr: Pr): Promise<string[]> {
  logger.debug('Searching for CODEOWNERS file');
  try {
    // Find CODEOWNERS file
    const codeOwnersFile =
      (await readLocalFile('CODEOWNERS', 'utf8')) ??
      (await readLocalFile('.bitbucket/CODEOWNERS', 'utf8')) ??
      (await readLocalFile('.github/CODEOWNERS', 'utf8')) ??
      (await readLocalFile('.gitlab/CODEOWNERS', 'utf8')) ??
      (await readLocalFile('docs/CODEOWNERS', 'utf8'));

    if (!codeOwnersFile) {
      logger.debug('No CODEOWNERS file found');
      return [];
    }

    logger.debug(`Found CODEOWNERS file: ${codeOwnersFile}`);

    // Get list of modified files in PR
    const prFiles = await getBranchFiles(pr.sourceBranch);

    if (!prFiles?.length) {
      logger.debug('PR includes no files');
      return [];
    }

    // Convert CODEOWNERS file into list of matching rules
    const cleanedLines = parseCodeOwnersContent(codeOwnersFile);

    const fileOwnerRules =
      platform.extractRulesFromCodeOwnersLines?.(cleanedLines) ??
      cleanedLines.map(extractOwnersFromLine);

    logger.debug(
      { prFiles, fileOwnerRules },
      'PR files and rules to match for CODEOWNERS',
    );

    // Apply rules & get list of owners for each prFile
    const emptyRules = fileOwnerRules.filter(
      (rule) => rule.usernames.length === 0,
    );
    const fileOwners =
      // Map through all prFiles and match said file(s) with all the rules
      prFiles
        .map((file) => matchFileToOwners(file, fileOwnerRules))

        // Match file again but this time only with emptyRules, to ensure that files which have no owner set remain owner-less
        .map((matchedFile) => {
          const matchEmpty = emptyRules.find((rule) =>
            rule.match(matchedFile.file),
          );
          if (matchEmpty) {
            return { ...matchedFile, userScoreMap: new Map<string, number>() };
          }
          return matchedFile;
        });

    logger.debug(
      `CODEOWNERS matched the following files: ${fileOwners
        .map((f) => f.file)
        .join(', ')}`,
    );

    // Get list of all matched users and the files they own (reverse keys of fileOwners)
    const usersWithOwnedFiles = getOwnerList(fileOwners);

    // Calculate a match score for each user. This allows sorting of the final user array in a way that guarantees that users matched with more precise patterns are first and users matched with less precise patterns are last (wildcards)
    const userScore = usersWithOwnedFiles
      .map((userMatch) => ({
        user: userMatch.username,
        score: Array.from(userMatch.fileScoreMap.values()).reduce(
          (acc, score) => acc + score,
          0,
        ),
      }))
      .sort((a, b) => b.score - a.score);

    logger.debug(
      `CODEOWNERS matched the following users: ${JSON.stringify(userScore)}`,
    );

    return userScore.map((u) => u.user);
  } catch (err) {
    logger.warn({ err, pr }, 'Failed to determine CODEOWNERS for PR.');
    return [];
  }
}
