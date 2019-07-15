const { getManagerList } = require('../../manager');
/**
 * Only if type condition or context condition violated then errors array will be mutated to store metadata
 * @param {Object} param
 * * {Obgect} param.resolvedRule
 * * {string} param.currentPath
 * @returns {Array} with finded error or empty array
 */
const check = ({ resolvedRule, currentPath }) => {
  let managersErrMessage;
  if (Array.isArray(resolvedRule.managers)) {
    if (
      resolvedRule.managers.find(
        confManager => !getManagerList().includes(confManager)
      )
    ) {
      managersErrMessage = `${currentPath}:
        You have included an unsupported manager in a package rule. Your list: ${
          resolvedRule.managers
        }.
        Supported managers are: (${getManagerList().join(', ')}).`;
    }
  } else if (typeof resolvedRule.managers !== 'undefined')
    managersErrMessage = `${currentPath}: Managers should be type of List. You have included ${typeof resolvedRule.managers}.`;

  return managersErrMessage
    ? [
        {
          depName: 'Configuration Error',
          message: managersErrMessage,
        },
      ]
    : [];
};

module.exports = { check };
