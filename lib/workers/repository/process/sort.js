module.exports = { sortBranches };

function sortBranches(branches) {
  // Sort branches
  const sortOrder = [
    'pin',
    'digest',
    'patch',
    'minor',
    'major',
    'lockFileMaintenance',
  ];
  logger.trace({ branches }, 'branches');
  branches.sort((a, b) => {
    const sortDiff = sortOrder.indexOf(a.type) - sortOrder.indexOf(b.type);
    if (sortDiff !== 0) {
      return sortDiff;
    }
    // Sort by prTitle if type is the same
    return a.prTitle < b.prTitle ? -1 : 1;
  });
}
