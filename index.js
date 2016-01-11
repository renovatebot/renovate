import React from 'react';
import collapse from 'collapse-white-space';
import {isElement} from 'react-addons-test-utils';
import isPlainObject from 'is-plain-object';
import stringify from 'stringify-object';
import sortobject from 'sortobject';
import traverse from 'traverse';
import fill from 'lodash/array/fill';

export default function reactElementToJSXString(ReactElement, options) {
  return toJSXString({ReactElement, options});
}

function toJSXString({ReactElement = null, lvl = 0, inline = false, options = {}}) {
  if (typeof ReactElement === 'string' || typeof ReactElement === 'number') {
    return ReactElement;
  } else if (!isElement(ReactElement)) {
    throw new Error('react-element-to-jsx-string: Expected a ReactElement, ' +
      'got `' + (typeof ReactElement) + '`');
  }

  let getDisplayName = options.displayName || getDefaultDisplayName;
  let tagName = getDisplayName(ReactElement);

  let out = `<${tagName}`;
  let props = formatProps(ReactElement.props, options);
  let attributes = [];
  let children = React.Children.toArray(ReactElement.props.children)
    .filter(onlyMeaningfulChildren);

  if (ReactElement.ref !== null) {
    attributes.push(getJSXAttribute('ref', ReactElement.ref, options));
  }

  if (ReactElement.key !== null &&
      // React automatically add key=".X" when there are some children
      !/^\./.test(ReactElement.key)) {
    attributes.push(getJSXAttribute('key', ReactElement.key, options));
  }

  attributes = attributes.concat(props);

  attributes.forEach(attribute => {
    if (attributes.length === 1 || inline) {
      out += ` `;
    } else {
      out += `\n${spacer(lvl + 1)}`;
    }

    out += `${attribute.name}=${attribute.value}`;
  });

  if (attributes.length > 1 && !inline) {
    out += `\n${spacer(lvl)}`;
  }

  if (children.length > 0) {
    out += `>`;
    lvl++;
    if (!inline) {
      out += `\n`;
      out += spacer(lvl);
    }

    if (typeof children === 'string') {
      out += children;
    } else {
      out += children
        .reduce(mergePlainStringChildren, [])
        .map(
          recurse({lvl, inline, options})
        ).join('\n' + spacer(lvl));
    }
    if (!inline) {
      out += `\n`;
      out += spacer(lvl - 1);
    }
    out += `</${tagName}>`;
  } else {
    if (attributes.length <= 1) {
      out += ` `;
    }

    out += '/>';
  }

  return out;
}

function getDefaultDisplayName(ReactElement) {
  return ReactElement.type.name || // function name
    ReactElement.type.displayName ||
    (typeof ReactElement.type === 'function' ? // function without a name, you should provide one
      'No Display Name' :
      ReactElement.type);
}

function mergePlainStringChildren(prev, cur) {
  var lastItem = prev[prev.length - 1];

  if (typeof cur === 'number') {
    cur = '' + cur;
  }

  if (typeof lastItem === 'string' && typeof cur === 'string') {
    prev[prev.length - 1] += cur;
  } else {
    prev.push(cur);
  }

  return prev;
}

function formatProps(props, options) {
  return Object
    .keys(props)
    .filter(noChildren)
    .sort()
    .map(propName => {
      return getJSXAttribute(propName, props[propName], options);
    });
}

function getJSXAttribute(name, value, options) {
  return {
    name,
    value: formatJSXAttribute(value, options)
      .replace(/'?<__reactElementToJSXString__Wrapper__>/g, '')
      .replace(/<\/__reactElementToJSXString__Wrapper__>'?/g, '')
  };
}

function formatJSXAttribute(propValue, options) {
  if (typeof propValue === 'string') {
    return `"${propValue}"`;
  }

  return `{${formatValue(propValue, options)}}`;
}

function formatValue(value, options) {
  if (typeof value === 'function') {
    return function noRefCheck() {};
  } else if (isElement(value)) {
    // we use this delimiter hack in cases where the react element is a property
    // of an object from a root prop
    // i.e.
    //   reactElementToJSXString(<div a={{b: <div />}} />
    //   // <div a={{b: <div />}} />
    // we then remove the whole wrapping
    // otherwise, the element would be surrounded by quotes: <div a={{b: '<div />'}} />
    return '<__reactElementToJSXString__Wrapper__>' +
      toJSXString({ReactElement: value, inline: true, options}) +
      '</__reactElementToJSXString__Wrapper__>';
  } else if (isPlainObject(value) || Array.isArray(value)) {
    return '<__reactElementToJSXString__Wrapper__>' +
      stringifyObject(value, options) +
      '</__reactElementToJSXString__Wrapper__>';
  }

  return value;
}

function recurse({lvl, inline, options}) {
  return ReactElement => {
    return toJSXString({ReactElement, lvl, inline, options});
  };
}

function stringifyObject(obj, options) {
  if (Object.keys(obj).length > 0 || obj.length > 0) {
    obj = traverse(obj).map(function(value) {
      if (isElement(value) || this.isLeaf) {
        this.update(formatValue(value, options));
      }
    });

    obj = sortobject(obj);
  }

  return collapse(stringify(obj))
    .replace(/{ /g, '{')
    .replace(/ }/g, '}')
    .replace(/\[ /g, '[')
    .replace(/ \]/g, ']');
}

function spacer(times) {
  return fill(new Array(times), `  `).join(``);
}

function noChildren(propName) {
  return propName !== 'children';
}

function onlyMeaningfulChildren(children) {
  return children !== true && children !== false && children !== null && children !== '';
}
