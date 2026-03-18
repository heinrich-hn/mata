import 'react';

declare global {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Element extends React.ReactElement {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ElementClass extends React.Component {}
    interface ElementAttributesProperty { 
      props: object;
    }
    interface ElementChildrenAttribute { 
      children: object;
    }
    type IntrinsicElements = React.JSX.IntrinsicElements;
  }
}