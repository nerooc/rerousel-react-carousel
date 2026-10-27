import { act, createRef, StrictMode, useEffect, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Rerousel, type RerouselHandle } from '../src/index';
import { dimensions, fire, motion, render, scrollTo, tick, unmount } from './setup';

const slides = [<div key="a">A</div>, <div key="b">B</div>, <div key="c">C</div>];
const keys = (el: HTMLElement, key: string) =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });

describe('native carousel', () => {
  it('waits a complete interval, advances one actual slide, then wraps instantly without reversing', () => {
    const el = render(<Rerousel>{slides}</Rerousel>);
    dimensions(el);
    tick(2999);
    expect(scrollTo).not.toHaveBeenCalled();
    tick(1);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 200, behavior: 'smooth' });
    tick();
    expect(el.scrollLeft).toBe(400);
    tick();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'instant' });
  });
  it('measures unequal widths and gaps, including a partially visible final slide', () => {
    const el = render(<Rerousel>{slides}</Rerousel>);
    dimensions(el, [180, 260, 200], 240);
    tick();
    expect(el.scrollLeft).toBe(180);
    tick();
    expect(el.scrollLeft).toBe(400);
    tick();
    expect(el.scrollLeft).toBe(0);
  });
  it('uses the current scroll position after a manual swipe', () => {
    const el = render(<Rerousel>{slides}</Rerousel>);
    dimensions(el);
    el.scrollLeft = 210;
    tick();
    expect(el.scrollLeft).toBe(400);
  });
  it('supports explicit advance distance and finite mode', () => {
    const el = render(
      <Rerousel itemWidth={100} loop={false}>
        {slides}
      </Rerousel>,
    );
    dimensions(el);
    tick();
    expect(el.scrollLeft).toBe(100);
    tick(12000);
    expect(el.scrollLeft).toBe(400);
  });
  it('does not create a timer when all content fits, or there are no slides', () => {
    const el = render(<Rerousel>{slides}</Rerousel>);
    dimensions(el, [200, 200, 200], 800);
    tick(12000);
    expect(scrollTo).not.toHaveBeenCalled();
    render(<Rerousel />);
    tick();
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it.each([0, -1, NaN, Infinity, 2147483648])('disables autoplay for interval %s', (interval) => {
    const el = render(<Rerousel interval={interval}>{slides}</Rerousel>);
    dimensions(el);
    tick(12000);
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it('pauses and resumes without leaking timers on stop, interval updates and unmount', () => {
    const el = render(<Rerousel>{slides}</Rerousel>);
    dimensions(el);
    render(<Rerousel stop>{slides}</Rerousel>);
    tick(6000);
    expect(scrollTo).not.toHaveBeenCalled();
    render(<Rerousel interval={1000}>{slides}</Rerousel>);
    tick(1000);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    unmount();
    tick(6000);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans up correctly under React StrictMode', () => {
    const el = render(
      <StrictMode>
        <Rerousel>{slides}</Rerousel>
      </StrictMode>,
    );
    dimensions(el);
    tick();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('pauses on hover and when a document is hidden', () => {
    const el = render(<Rerousel>{slides}</Rerousel>);
    dimensions(el);
    fire(el, 'pointerenter');
    tick();
    expect(scrollTo).not.toHaveBeenCalled();
    fire(el, 'pointerleave');
    tick();
    expect(el.scrollLeft).toBe(200);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    fire(document, 'visibilitychange');
    tick();
    expect(el.scrollLeft).toBe(200);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    fire(document, 'visibilitychange');
    tick();
    expect(el.scrollLeft).toBe(400);
  });
  it('can opt out of hover pause', () => {
    const el = render(<Rerousel pauseOnHover={false}>{slides}</Rerousel>);
    dimensions(el);
    fire(el, 'pointerenter');
    tick();
    expect(el.scrollLeft).toBe(200);
  });
  it('respects changed reduced-motion preferences and avoids smooth manual motion', () => {
    const el = render(<Rerousel>{slides}</Rerousel>);
    dimensions(el);
    Object.assign(motion, { matches: true });
    fire(motion, 'change');
    tick();
    expect(scrollTo).not.toHaveBeenCalled();
    keys(el, 'ArrowRight');
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 200, behavior: 'instant' });
    Object.assign(motion, { matches: false });
    fire(motion, 'change');
    tick();
    expect(el.scrollLeft).toBe(400);
  });
  it('supports keyboard boundaries and custom next/previous controls while stopped', () => {
    const ref = createRef<RerouselHandle>();
    const el = render(
      <Rerousel ref={ref} stop>
        {slides}
      </Rerousel>,
    );
    dimensions(el);
    expect(ref.current?.element).toBe(el);
    ref.current?.previous();
    expect(el.scrollLeft).toBe(400);
    keys(el, 'Home');
    expect(el.scrollLeft).toBe(0);
    keys(el, 'End');
    expect(el.scrollLeft).toBe(400);
    ref.current?.next();
    expect(el.scrollLeft).toBe(0);
    keys(el, 'ArrowRight');
    expect(el.scrollLeft).toBe(200);
    keys(el, 'ArrowLeft');
    expect(el.scrollLeft).toBe(0);
  });
  it('does not consume keys from interactive descendants or prevented events', () => {
    const el = render(
      <Rerousel
        onKeyDown={(e) => {
          if (e.key === 'End') e.preventDefault();
        }}
      >
        <input />
        <div>B</div>
        <div>C</div>
      </Rerousel>,
    );
    dimensions(el);
    keys(el.querySelector('input')!, 'ArrowRight');
    keys(el, 'End');
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it('preserves a single live component, DOM refs, IDs and form state through repeated loops', () => {
    let mounts = 0;
    const input = createRef<HTMLInputElement>();
    const ref = createRef<RerouselHandle>();
    function Interactive() {
      const [count, setCount] = useState(0);
      useEffect(() => {
        mounts++;
      }, []);
      return (
        <div>
          <input id="unique" ref={input} defaultValue="saved" />
          <button onClick={() => setCount(count + 1)}>{count}</button>
        </div>
      );
    }
    const el = render(
      <Rerousel ref={ref}>
        <Interactive />
        <div>B</div>
        <div>C</div>
      </Rerousel>,
    );
    dimensions(el);
    const original = input.current;
    act(() => el.querySelector('button')!.click());
    for (let i = 0; i < 12; i++) ref.current?.next();
    expect(mounts).toBe(1);
    expect(input.current).toBe(original);
    expect(document.querySelectorAll('#unique')).toHaveLength(1);
    expect(el.querySelector('button')?.textContent).toBe('1');
    expect(input.current?.value).toBe('saved');
  });
  it('pauses for focus within without stealing focus', () => {
    const el = render(
      <Rerousel>
        <input />
        <div>B</div>
        <div>C</div>
      </Rerousel>,
    );
    dimensions(el);
    const input = el.querySelector('input')!;
    act(() => input.focus());
    tick();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });
  it('re-measures after responsive resize without resetting the scroll position', () => {
    const el = render(<Rerousel>{slides}</Rerousel>);
    dimensions(el);
    tick();
    dimensions(el, [300, 300, 300], 300);
    tick();
    expect(el.scrollLeft).toBe(300);
  });
  it('handles changing children and supports legacy itemRef without duplicating it', () => {
    const ref = createRef<HTMLDivElement>();
    const el = render(
      <Rerousel itemRef={ref}>
        <div ref={ref}>A</div>
        <div>B</div>
      </Rerousel>,
    );
    dimensions(el, [200, 200]);
    tick();
    expect(el.scrollLeft).toBe(200);
    expect(ref.current).toBe(el.firstElementChild);
    render(
      <Rerousel>
        <div>A</div>
        <div>B</div>
        <div>C</div>
      </Rerousel>,
    );
    dimensions(el);
    tick();
    expect(el.scrollLeft).toBe(400);
  });
  it('handles negative RTL scroll positions and visual arrow direction', () => {
    const el = render(
      <Rerousel dir="rtl" style={{ direction: 'rtl' }}>
        {slides}
      </Rerousel>,
    );
    dimensions(el);
    [...el.children].forEach((child, index) =>
      Object.defineProperty(child, 'offsetLeft', { configurable: true, value: 400 - index * 200 }),
    );
    tick();
    expect(el.scrollLeft).toBe(-200);
    keys(el, 'ArrowLeft');
    expect(el.scrollLeft).toBe(-400);
    keys(el, 'ArrowRight');
    expect(el.scrollLeft).toBe(-200);
  });
  it('renders on the server with no browser globals and includes a CSP nonce', () => {
    const html = renderToString(
      <Rerousel nonce="example-nonce" aria-label="Products">
        {slides}
      </Rerousel>,
    );
    expect(html).toContain('nonce="example-nonce"');
    expect(html).toContain('Products');
    expect((html.match(/>A</g) || []).length).toBe(1);
  });
});
