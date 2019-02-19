const { getManagerList } = require('../../manager');
/**
 * Only if type condition or context condition violated then errors array will be mutated to store metadata
 * @param {Obgect} param
 * * {Obgect} param.resolvedRule
 * * {string} myObj.currentPath
 * @returns {Array} with finded error or empty array
 */
const checkManagers = ({ resolvedRule, currentPath }) => {
  const ref =
    'Please visit https://renovatebot.com/docs/configuration-options/#managers for additional info';
  let managersErrMessage;
  if (Array.isArray(resolvedRule.managers)) {
    if (
      resolvedRule.managers.find(
        confManager => !getManagerList().includes(confManager)
      )
    ) {
      managersErrMessage = `${currentPath}:
        You have included unsupported manager: ${resolvedRule.managers}. 
        Supported managers are: (${getManagerList().join(', ')}). ${ref}`;
    }
  } else if (typeof resolvedRule.managers !== 'undefined')
    managersErrMessage = `${currentPath}: Managers should be type of List. You have included ${typeof resolvedRule.managers}. ${ref}`;

  return managersErrMessage
    ? [
        {
          depName: 'Configuration Error',
          message: managersErrMessage,
        },
      ]
    : [];
};

module.exports = { checkManagers };
