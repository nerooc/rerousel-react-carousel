# Rerousel

A tiny, unstyled carousel for React. **1.44 kB gzipped**, zero runtime dependencies, and fully interactive slides.

[Live playground & docs](https://rerousel.netlify.app/) · [npm](https://www.npmjs.com/package/rerousel) · [Issues](https://github.com/aexol-studio/rerousel-react-carousel/issues)

> **v1 is a breaking release.** Read the [migration guide](#migrating-from-0x) before upgrading from 0.x.

## Why Rerousel?

- Native touch scrolling and CSS scroll snapping.
- Automatic advancing and end-to-start looping, with optional finite mode.
- One live copy of each slide: React state, DOM refs, unique IDs and form values survive loops.
- Keyboard navigation, pause on hover/focus, reduced-motion support and hidden-tab pause.
- Automatic sizing handles responsive and unequal slide widths, gaps, padding and borders.
- TypeScript declarations, ESM and CommonJS exports; React stays external.
- No theme, navigation UI, animation framework or CSS import. Bring your own styles and controls.

The size is the minified ESM entry compressed with gzip level 9, excluding React. The build measures it and enforces a **1,600-byte gzip ceiling**. This is not a claim about the size of React, the demo, or the npm tarball. See [the reproducible size check](https://github.com/aexol-studio/rerousel-react-carousel/blob/master/scripts/size.mjs).

## Install

```sh
npm install rerousel
```

Requires **React 18.3.1 or React 19**. Tested with **18.3.1 and 19.3.1**. Uses current evergreen Chrome, Edge, Firefox and Safari, including mobile browsers; no legacy polyfills are bundled. The feature baseline is ResizeObserver, MediaQueryList.addEventListener, native smooth scrolling, CSS scroll snap and queueMicrotask (Chrome/Edge 79+, Firefox 74+, Safari/iOS 15.4+). Current versions are the tested support target; these minimum versions are inferred feature requirements, not separately tested browsers.

## Quick start

```tsx
import { Rerousel } from 'rerousel';

export function Gallery() {
  return (
    <Rerousel aria-label="Selected work" style={{ gap: 16 }}>
      {['Make', 'Something', 'Move'].map((title) => (
        <article key={title} style={{ width: 280, padding: 24 }}>
          <h2>{title}</h2>
        </article>
      ))}
    </Rerousel>
  );
}
```

Set widths on your slide elements. Use pixels, percentages, media queries or `clamp()`. Rerousel measures the actual DOM positions when advancing; a ref is not required. Give each direct DOM child its own slide element. Fragments are fine; bare text should be wrapped in an element. Margins and gaps are measured from the actual layout. Keep the scrolling container's horizontal padding symmetric for predictable edge alignment.

### Interactive slides & custom controls

```tsx
import { useRef, useState } from 'react';
import { Rerousel, type RerouselHandle } from 'rerousel';

export function InteractiveGallery() {
  const carousel = useRef<RerouselHandle>(null);
  const [paused, setPaused] = useState(false);

  return (
    <section aria-label="Product gallery">
      <button onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
        {paused ? 'Resume autoplay' : 'Pause autoplay'}
      </button>
      <Rerousel ref={carousel} stop={paused} aria-label="Products" style={{ gap: 16 }}>
        <article style={{ width: 280 }}>
          <label htmlFor="product-note">Your note</label>
          <input id="product-note" name="product-note" />
        </article>
        <article style={{ width: 280 }}>
          <a href="/products">Browse products</a>
        </article>
      </Rerousel>
      <button onClick={() => carousel.current?.previous()}>Previous</button>
      <button onClick={() => carousel.current?.next()}>Next</button>
    </section>
  );
}
```

The ref exposes `next()`, `previous()` and `element` (the native scrolling `HTMLDivElement`). Manual controls work while `stop` is true. Calls made during a smooth scroll are based on the current native scroll position; this is not an animation queue.

### How looping works

Slides scroll smoothly in their natural DOM order. At the end, the next advance resets **instantly** to the beginning; previous from the beginning resets to the end. There are no cloned slides, hidden copies or duplicated React trees. This preserves interactivity and keeps the package small. Rerousel is a carousel with a boundary reset, **not a continuous marquee**. Set `loop={false}` to stop at each boundary. If all slides fit, there is nothing to scroll and autoplay stays idle.

The component does not virtualize slides. For very large collections, paginate the data or choose a virtualized gallery.

## API

| Prop           | Type                             | Default   | Meaning                                                                                                 |
| -------------- | -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `children`     | `ReactNode`                      | —         | Your slide elements.                                                                                    |
| `interval`     | `number`                         | `3000`    | Milliseconds between advances. Non-positive, non-finite or values above 2,147,483,647 disable autoplay. |
| `stop`         | `boolean`                        | `false`   | Pause autoplay without disabling touch, keyboard or custom controls.                                    |
| `loop`         | `boolean`                        | `true`    | Wrap instantly at the start/end boundary.                                                               |
| `pauseOnHover` | `boolean`                        | `true`    | Pause autoplay while the pointer is inside.                                                             |
| `itemWidth`    | `number`                         | automatic | Optional fixed advance distance in CSS pixels. Invalid values fall back to measured positions.          |
| `itemRef`      | `RefObject<HTMLElement \| null>` | —         | Deprecated; accepted for migration but no longer read.                                                  |
| `ref`          | `Ref<RerouselHandle>`            | —         | Custom navigation methods and the native scroll element.                                                |

Standard `div` attributes pass through, including `className`, `style`, `dir`, `aria-label` and event handlers. `itemRef` retains its legacy React-ref meaning rather than HTML's microdata `itemref` attribute. If supplied, `nonce` is also applied to the small essential inline `<style>` element for CSP integrations. Strict CSP deployments must also allow the component's inline layout styles or supply equivalent styles under their policy.

The essential child layout CSS uses `.rerousel > *`. Avoid overriding `flex-shrink` or scroll snapping unless you intend to change the carousel's layout behavior. The component sets `position: relative` so child offsets can be measured; do not override it with `position: static`.

### Accessibility

- Set a descriptive `aria-label`; the default is “Carousel”.
- Provide a visible pause/resume control whenever autoplay is enabled. Rerousel deliberately does not render navigation UI for you.
- Focus the carousel itself and use **Left/Right**, **Home**, and **End**. Left/Right follow the visual direction in RTL. Keys originating in descendants are left to those components.
- Autoplay pauses while any part of the carousel has focus and resumes after focus leaves; it also pauses on hover by default and while the document is hidden. `stop` controls explicit user pause.
- `prefers-reduced-motion: reduce` disables autoplay and makes manual navigation instant. This preference takes priority over `stop={false}`.
- Your slide markup remains responsible for its own semantics, labels, contrast and focus indicators. The carousel is a region with `aria-roledescription="carousel"` and `tabIndex={0}`.

### SSR & React server components

Both entry points preserve `"use client"`. They can be imported and server-rendered without browser globals. In a React server component application, compose interactive examples and refs inside a client component. No DOM work happens during server rendering. Hydration renders the same slide tree without clones.

## Migrating from 0.x

1. Upgrade to React 18.3.1 or React 19. React 16/17 are no longer supported.
2. Remove `itemRef` unless you still need it for your own code. It is optional and deprecated.
3. Your children now render **once**. Remove workarounds for duplicated IDs, duplicated refs or double component effects.
4. Replace any expectation of duplicated-content looping with the documented instant boundary reset.
5. Add a descriptive label and app-owned pause control. Autoplay now pauses for focus, hover, hidden documents and reduced motion.
6. `interval` and `stop` retain their core meanings. The previously declared `itemWidth` prop now sets an explicit advance distance.
7. Bundlers use the ESM entry; CommonJS uses `require('rerousel')`. Deep imports into the old `lib` layout are unsupported; use the public package export.

## Development

Use **Node 24 LTS** (`nvm use`) and npm. Build and test tools are development dependencies only; they are excluded from the published package.

```sh
npm ci
npm run check          # TypeScript, unit suite, package + production demo build, size budget
npm run test:compat    # isolated React 18.3.1 / 19.3.1 runtime and type checks
npm run test:package   # packed artifact: file allowlist, ESM/CJS and real Node SSR
npx playwright install chromium firefox webkit
npm run test:browser   # desktop engines + mobile WebKit, interactions and axe audit
npm audit             # includes development dependencies
npm start             # live demo, consuming the built package
```

Run `npm run build` before `npm start`. The demo resolves the public `rerousel` import to the built ESM artifact, so the playground exercises the actual shipping implementation. The production demo output is `dist/`; Netlify configuration is in `netlify.toml`.

[Release procedure](https://github.com/aexol-studio/rerousel-react-carousel/blob/master/RELEASE.md) · [Launch drafts](https://github.com/aexol-studio/rerousel-react-carousel/blob/master/MARKETING.md) · [Design record](https://github.com/aexol-studio/rerousel-react-carousel/blob/master/DESIGN.md)

## Contributing

Open an issue with your React/browser versions and a minimal reproduction. For changes, add a regression test where behavior changes, keep the gzip size budget green, and run the relevant checks above. Send a pull request against the upstream repository.

MIT © [Aexol](https://aexol.com/).
