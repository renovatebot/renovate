import React from 'react';
import stringify from 'stringify-object';
import collapse from 'collapse-white-space';
import {isElement} from 'react-addons-test-utils';

export default function reactElementToJSXString(ReactElement) {
  return toJSXString({ReactElement});
}

function toJSXString({ReactElement = null, lvl = 0, inline = false}) {
  if (!isElement(ReactElement)) {
    throw new Error('react-element-to-jsx-string: Expected a ReactElement');
  }

  let tagName;

  if (ReactElement.type === undefined) {
    tagName = 'UnknownElement';
  } else {
    tagName = ReactElement.type.name ||
      ReactElement.type.displayName ||
      ReactElement.type;
  }

  let out = `<${tagName}`;
  let props = formatProps(ReactElement.props);
  let children = ReactElement.props.children;

  props.forEach(prop => {
    if (props.length === 1 || inline) {
      out += ` `;
    } else {
      out += `\n${spacer(lvl + 1)}`;
    }

    out += `${prop.name}=${prop.value}`;
  });

  if (props.length > 1 && !inline) {
    out += `\n${spacer(lvl)}`;
  }

  if (React.Children.count(children) > 0) {
    out += `>`;
    lvl++;
    if (!inline) {
      out += `\n`;
      out += spacer(lvl);
    }

    if (typeof children === 'string') {
      out += children;
    } else {
      out += React.Children
        .toArray(children)
        .map(
          recurse({lvl, inline})
        );
    }
    if (!inline) {
      out += `\n`;
      out += spacer(lvl - 1);
    }
    out += `</${tagName}>`;
  } else {
    if (props.length <= 1) {
      out += ` `;
    }

    out += '/>';
  }

  return out;
}

function formatProps(props) {
  return Object
    .keys(props)
    .filter(noChildren)
    .sort()
    .map(propName => {
      return {
        name: propName,
        value: formatPropValue(props[propName])
      };
    });
}

function formatPropValue(propValue) {
  if (typeof propValue === 'string') {
    return `"${propValue}"`;
  }

  let out = `{`;

  if (typeof propValue === 'function') {
    out += `function () {code;}`;
  } else if (typeof propValue === 'number') {
    out += propValue;
  } else if (isElement(propValue)) {
    out += toJSXString({ReactElement: propValue, inline: true});
  } else {
    out += stringifyObject(propValue);
  }

  out += `}`;

  return out;
}

function recurse({lvl, inline}) {
  return ReactElement => {
    return toJSXString({ReactElement, lvl, inline});
  };
}

function stringifyObject(obj) {
  return collapse(stringify(obj))
    .replace(/^{ /, '{')
    .replace(/ }$/, '}');
}

function spacer(times) {
  return new Array(times).fill(`  `).join(``);
}

function noChildren(propName) {
  return propName !== 'children';
}
