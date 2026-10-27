import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';

export interface RerouselProps extends Omit<HTMLAttributes<HTMLDivElement>, 'itemRef'> {
  children?: ReactNode;
  /** Milliseconds between advances. Non-positive/non-finite values disable autoplay. */
  interval?: number;
  /** Pause autoplay. Manual navigation remains available. */
  stop?: boolean;
  /** Wrap at the boundary. The reset is instant; slides are never cloned. */
  loop?: boolean;
  /** Pause autoplay while the pointer is over the carousel. */
  pauseOnHover?: boolean;
  /** Optional fixed advance distance in CSS pixels; otherwise measure actual slides. */
  itemWidth?: number;
  /** @deprecated No longer needed. Slides are measured automatically. */
  itemRef?: RefObject<HTMLElement | null>;
}

export interface RerouselHandle {
  next(): void;
  previous(): void;
  /** The native scrolling element, for custom controls and integrations. */
  readonly element: HTMLDivElement | null;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)');
const css =
  '.rerousel{scroll-snap-type:x mandatory}.rerousel:focus-within{scroll-snap-type:none}.rerousel>*{flex-shrink:0;box-sizing:border-box;scroll-snap-align:start}.rerousel::-webkit-scrollbar{display:none}';

/** An unstyled, native-scroll carousel. One live copy of each child; no cloning. */
export const Rerousel = forwardRef<RerouselHandle, RerouselProps>(function Rerousel(
  {
    children,
    interval = 3000,
    stop = false,
    loop = true,
    pauseOnHover = true,
    itemWidth,
    itemRef: _itemRef,
    className = '',
    style,
    onKeyDown,
    nonce,
    ...props
  },
  ref,
) {
  const viewport = useRef<HTMLDivElement>(null);

  const move = useCallback(
    (direction: number, edge = false) => {
      const el = viewport.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) return;
      const sign = getComputedStyle(el).direction === 'rtl' ? -1 : 1;
      const position = sign * el.scrollLeft;
      const boundary = direction > 0 ? position >= max - 1 : position <= 1;
      let target: number;
      if (edge || boundary) {
        if (boundary && !loop && !edge) return;
        target = direction > 0 ? 0 : max;
      } else if (itemWidth && Number.isFinite(itemWidth) && itemWidth > 0) {
        target = Math.max(0, Math.min(max, position + direction * itemWidth));
      } else {
        const slides = Array.from(el.children) as HTMLElement[];
        const first = slides[0];
        if (!first) return;
        const offsets = slides.map((slide) => Math.min(max, sign * (slide.offsetLeft - first.offsetLeft)));
        target =
          direction > 0
            ? (offsets.find((offset) => offset > position + 1) ?? max)
            : (offsets.reverse().find((offset) => offset < position - 1) ?? 0);
      }
      el.scrollTo({
        left: sign * target,
        behavior: boundary || edge || reducedMotion().matches ? 'instant' : 'smooth',
      });
    },
    [itemWidth, loop],
  );

  useImperativeHandle(
    ref,
    () => ({
      next: () => move(1),
      previous: () => move(-1),
      get element() {
        return viewport.current;
      },
    }),
    [move],
  );

  useEffect(() => {
    const el = viewport.current;
    if (!el || stop || !Number.isFinite(interval) || interval <= 0 || interval > 2147483647) return;
    const motion = reducedMotion();
    let timer: ReturnType<typeof setInterval> | undefined;
    let hovered = pauseOnHover && el.matches(':hover');
    let active = true;
    const sync = () => {
      clearInterval(timer);
      timer = undefined;
      if (
        active &&
        !motion.matches &&
        !document.hidden &&
        !hovered &&
        !el.contains(document.activeElement) &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        timer = setInterval(() => move(1), interval);
      }
    };
    const enter = () => {
      hovered = pauseOnHover;
      sync();
    };
    const leave = () => {
      hovered = false;
      sync();
    };
    // focusout fires before document.activeElement changes; cleanup guards the microtask.
    const blur = () => queueMicrotask(sync);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focusin', sync);
    el.addEventListener('focusout', blur);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    sync();
    return () => {
      active = false;
      clearInterval(timer);
      observer.disconnect();
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('focusin', sync);
      el.removeEventListener('focusout', blur);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
    };
  }, [children, interval, stop, pauseOnHover, move]);

  return (
    <>
      <style nonce={nonce}>{css}</style>
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Carousel"
        tabIndex={0}
        {...props}
        nonce={nonce}
        className={`rerousel ${className}`.trim()}
        ref={viewport}
        style={{
          display: 'flex',
          position: 'relative',
          alignItems: 'center',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          ...style,
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (
            event.defaultPrevented ||
            event.target !== event.currentTarget ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return;
          const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
          const direction =
            event.key === 'ArrowRight'
              ? rtl
                ? -1
                : 1
              : event.key === 'ArrowLeft'
                ? rtl
                  ? 1
                  : -1
                : event.key === 'Home'
                  ? 1
                  : event.key === 'End'
                    ? -1
                    : 0;
          if (direction) {
            event.preventDefault();
            move(direction, event.key === 'Home' || event.key === 'End');
          }
        }}
      >
        {children}
      </div>
    </>
  );
});
