import React from 'react';
import collapse from 'collapse-white-space';
import {isElement} from 'react-addons-test-utils';
import isPlainObject from 'is-plain-object';
import stringify from 'stringify-object';
import sortobject from 'sortobject';
import traverse from 'traverse';
import {fill} from 'lodash';

export default function reactElementToJSXString(
  ReactElement, {
    displayName,
    showDefaultProps = true,
    showFunctions = false
  } = {}
) {
  const getDisplayName = displayName || getDefaultDisplayName;

  return toJSXString({ReactElement});

  function toJSXString({ReactElement: Element = null, lvl = 0, inline = false}) {
    if (typeof Element === 'string' || typeof Element === 'number') {
      return Element;
    } else if (!isElement(Element)) {
      throw new Error(
`react-element-to-jsx-string: Expected a ReactElement,
got \`${typeof Element}\``
      );
    }

    const tagName = getDisplayName(Element);

    let out = `<${tagName}`;
    const props = formatProps(Element.props, getDefaultProps(Element));
    let attributes = [];
    const children = React.Children.toArray(Element.props.children)
    .filter(onlyMeaningfulChildren);

    if (Element.ref !== null) {
      attributes.push(getJSXAttribute('ref', Element.ref));
    }

    if (Element.key !== null &&
      // React automatically add key=".X" when there are some children
      !(/^\./).test(Element.key)) {
      attributes.push(getJSXAttribute('key', Element.key));
    }

    attributes = attributes.concat(props);

    attributes.forEach(attribute => {
      if (attributes.length === 1 || inline) {
        out += ' ';
      } else {
        out += `\n${spacer(lvl + 1)}`;
      }

      if (attribute.value === '{true}') {
        out += `${attribute.name}`;
      } else {
        out += `${attribute.name}=${attribute.value}`;
      }
    });

    if (attributes.length > 1 && !inline) {
      out += `\n${spacer(lvl)}`;
    }

    if (children.length > 0) {
      out += '>';
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
          recurse({lvl, inline})
        ).join(`\n${spacer(lvl)}`);
      }
      if (!inline) {
        out += `\n`;
        out += spacer(lvl - 1);
      }
      out += `</${tagName}>`;
    } else {
      if (attributes.length <= 1) {
        out += ' ';
      }

      out += '/>';
    }

    return out;
  }

  function formatProps(props, defaultProps) {
    let formatted = Object
      .keys(props)
      .filter(noChildren)
      .filter(key => noFalse(props[key]));

    if (!showDefaultProps) {
      formatted = formatted.filter(key => defaultProps[key] ? defaultProps[key] !== props[key] : true);
    }

    return formatted
      .sort()
      .map(propName => getJSXAttribute(propName, props[propName]));
  }

  function getJSXAttribute(name, value) {
    return {
      name,
      value: formatJSXAttribute(value)
        .replace(/'?<__reactElementToJSXString__Wrapper__>/g, '')
        .replace(/<\/__reactElementToJSXString__Wrapper__>'?/g, '')
    };
  }

  function formatJSXAttribute(propValue) {
    if (typeof propValue === 'string') {
      return `"${propValue}"`;
    }

    return `{${formatValue(propValue)}}`;
  }

  function formatValue(value) {
    const wrapper = '__reactElementToJSXString__Wrapper__';

    if (typeof value === 'function' && !showFunctions) {
      return function noRefCheck() {};
    } else if (isElement(value)) {
      // we use this delimiter hack in cases where the react element is a property
      // of an object from a root prop
      // i.e.
      //   reactElementToJSXString(<div a={{b: <div />}} />
      //   // <div a={{b: <div />}} />
      // we then remove the whole wrapping
      // otherwise, the element would be surrounded by quotes: <div a={{b: '<div />'}} />
      return `<${wrapper}>${toJSXString({ReactElement: value, inline: true})}</${wrapper}>`;
    } else if (isPlainObject(value) || Array.isArray(value)) {
      return `<${wrapper}>${stringifyObject(value)}</${wrapper}>`;
    }

    return value;
  }

  function recurse({lvl, inline}) {
    return Element => toJSXString({ReactElement: Element, lvl, inline});
  }

  function stringifyObject(obj) {
    if (Object.keys(obj).length > 0 || obj.length > 0) {
      // eslint-disable-next-line array-callback-return
      obj = traverse(obj).map(function(value) {
        if (isElement(value) || this.isLeaf) {
          this.update(formatValue(value));
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
}


function getDefaultDisplayName(ReactElement) {
  return ReactElement.type.name || // function name
    ReactElement.type.displayName ||
    (typeof ReactElement.type === 'function' ? // function without a name, you should provide one
      'No Display Name' :
      ReactElement.type);
}

function getDefaultProps(ReactElement) {
  return ReactElement.type.defaultProps || {};
}

function mergePlainStringChildren(prev, cur) {
  const lastItem = prev[prev.length - 1];

  if (typeof cur === 'number') {
    cur = String(cur);
  }

  if (typeof lastItem === 'string' && typeof cur === 'string') {
    prev[prev.length - 1] += cur;
  } else {
    prev.push(cur);
  }

  return prev;
}

function spacer(times) {
  return fill(new Array(times), '  ').join('');
}

function noChildren(propName) {
  return propName !== 'children';
}

function noFalse(propValue) {
  return typeof propValue !== 'boolean' || propValue;
}

function onlyMeaningfulChildren(children) {
  return children !== true && children !== false && children !== null && children !== '';
}
