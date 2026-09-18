import type { JSX as ReactJSX } from 'react'

// @types/react 19 no longer declares a global JSX namespace; keep `JSX.Element` usable in annotations.
declare global {
  namespace JSX {
    type Element = ReactJSX.Element
  }
}

export {}
