let body = '';

module.exports = {
  init,
  addParagraph,
  addLine,
  addList,
  addSubList,
  getBody,
};

function init() {
  body = '';
}

/**
 * 
 * @param {string} str 
 */
function addParagraph(str) {
  body += `${str}${'\n\n'}`;
}

function addLine() {
  body += `\n---\n`;
}

/**
 * 
 * @param {string} list of String 
 * @param {boolean} With number or bullet points
 */
function addList(lStr, isWithNumber = false) {
  const specialchar = isWithNumber ? '1. ' : '- ';
  body += specialchar + lStr.join('\n' + specialchar) + '\n\n';
}

/**
 * 
 * @param {string} list of String 
 * @param {boolean} With number or bullet points
 */
function addSubList(lStr, isWithNumber = false) {
  const specialchar = isWithNumber ? '\n  1. ' : '\n  - ';
  return specialchar + lStr.join(specialchar);
}

function getBody() {
  return body;
}
