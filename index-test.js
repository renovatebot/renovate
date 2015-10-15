/* eslint-env mocha */

import React from 'react';
import expect from 'expect';
import reactElementToJSXString from './index';

class TestComponent extends React.Component {}

describe(`reactElementToJSXString(ReactElement)`, () => {
  it(`reactElementToJSXString(<TestComponent/>)`, () => {
    expect(
      reactElementToJSXString(<TestComponent/>)
    ).toEqual(`<TestComponent />`);
  });

  it(`reactElementToJSXString(React.createElement('div'))`, () => {
    expect(
      reactElementToJSXString(React.createElement('div'))
    ).toEqual(`<div />`);
  });

  it(`reactElementToJSXString(<div/>)`, () => {
    expect(
      reactElementToJSXString(<div/>)
    ).toEqual(`<div />`);
  });

  it(`reactElementToJSXString(<div fn={() => {}}/>)`, () => {
    expect(
      reactElementToJSXString(<div fn={() => {}}/>)
    ).toEqual(`<div fn={function () {code;}} />`);
  });

  it(`reactElementToJSXString(<div fn={function hello(){}}/>)`, () => {
    expect(
      reactElementToJSXString(<div fn={function hello() {}}/>)
    ).toEqual(`<div fn={function () {code;}} />`);
  });

  it(`reactElementToJSXString(<div co={<div a="1" />} />)`, () => {
    expect(
      reactElementToJSXString(<div co={<div a="1" />}/>)
    ).toEqual(`<div co={<div a="1" />} />`);
  });

  it(`reactElementToJSXString(<div re={/^Hello world$/} />)`, () => {
    expect(
      reactElementToJSXString(<div re={/^Hello world$/}/>)
    ).toEqual(`<div re={/^Hello world$/} />`);
  });

  it(`reactElementToJSXString(<div int={8}/>)`, () => {
    expect(
      reactElementToJSXString(<div int={8}/>)
    ).toEqual(`<div int={8} />`);
  });

  it(`reactElementToJSXString(<div obj={{hello: 'world'}}/>)`, () => {
    expect(
      reactElementToJSXString(<div obj={{hello: 'world'}}/>)
    ).toEqual(`<div obj={{hello: 'world'}} />`);
  });

  it(`reactElementToJSXString(<div obj={{hello: [1, 2], world: {nested: true}}}/>)`, () => {
    expect(
      reactElementToJSXString(<div obj={{hello: [1, 2], world: {nested: true}}}/>)
    ).toEqual(`<div obj={{hello: [1, 2], world: {nested: true}}} />`);
  });

  it(`reactElementToJSXString(<div></div>)`, () => {
    expect(
      reactElementToJSXString(<div></div>)
    ).toEqual(`<div />`);
  });

  it(`reactElementToJSXString(<div z="3" a="1" b="2"/>)`, () => {
    /* eslint react/jsx-sort-props: 0 */
    expect(
      reactElementToJSXString(<div z="3" a="1" b="2"/>)
    ).toEqual(
`<div
  a="1"
  b="2"
  z="3"
/>`);
  });

  it(`reactElementToJSXString(<div a="1">Hello</div>)`, () => {
    expect(
      reactElementToJSXString(<div a="1">Hello</div>)
    ).toEqual(
`<div a="1">
  Hello
</div>`);
  });

  it(`reactElementToJSXString(<div a="1" b="5">Hello</div>)`, () => {
    expect(
      reactElementToJSXString(<div a="1" b="5">Hello</div>)
    ).toEqual(
`<div
  a="1"
  b="5"
>
  Hello
</div>`);
  });

  it(`reactElementToJSXString(<div>Hello</div>)`, () => {
    expect(
      reactElementToJSXString(<div>Hello</div>)
    ).toEqual(
`<div>
  Hello
</div>`);
  });

  it(`reactElementToJSXString(<div><div>Hello</div></div>)`, () => {
    expect(
      reactElementToJSXString(<div><div>Hello</div></div>)
    ).toEqual(
`<div>
  <div>
    Hello
  </div>
</div>`);
  });

  it(`reactElementToJSXString(<div a="1" b="2"><div>Hello</div></div>)`, () => {
    expect(
      reactElementToJSXString(<div a="1" b="2"><div>Hello</div></div>)
    ).toEqual(
`<div
  a="1"
  b="2"
>
  <div>
    Hello
  </div>
</div>`);
  });

  it(`reactElementToJSXString()`, () => {
    expect(() => {
      reactElementToJSXString();
    }).toThrow('react-element-to-jsx-string: Expected a ReactElement');
  });

  it(`reactElementToJSXString(null)`, () => {
    expect(() => {
      reactElementToJSXString(null);
    }).toThrow('react-element-to-jsx-string: Expected a ReactElement');
  });
});
