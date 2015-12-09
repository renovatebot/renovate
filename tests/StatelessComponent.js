import React from 'react';
export default function StatelessComponent(props) {
  let {children} = props;
  return <div>{children}</div>;
}
