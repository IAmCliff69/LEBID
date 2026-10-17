import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Ellipsis,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The tabs. "pages" lists every page that belongs under a tab, so the tab
// stays highlighted on those pages (for example More on the Exams page).
// ---------------------------------------------------------------------------
interface Tab {
  label: string;
  to: string;
  icon: LucideIcon | null; // null = the LEBID logo (Home)
  pages: string[];
}

const tabs: Tab[] = [
  { label: "Home", to: "/dashboard", icon: null, pages: ["/dashboard"] },
  { label: "Study Planner", to: "/planner", icon: CalendarClock, pages: ["/planner"] },
  { label: "Tasks", to: "/tasks", icon: ClipboardList, pages: ["/tasks"] },
  { label: "Timetable", to: "/timetable", icon: CalendarDays, pages: ["/timetable"] },
  {
    label: "More",
    to: "/more",
    icon: Ellipsis,
    pages: [
      "/more",
      "/assignments",
      "/exams",
      "/events",
      "/courses",
      "/conflicts",
      "/analytics",
      "/timetable-import",
    ],
  },
];

// ---------------------------------------------------------------------------
// The shape of the bar (all sizes in pixels). This is the desktop sidebar's
// shape turned on its side: the notch is cut from the TOP edge.
// ---------------------------------------------------------------------------
const BAR_THICKNESS = 64; // height of the bar
const CORNER = 24; // rounded corners of the bar
const BUBBLE = 44; // diameter of the highlighted circle
const NOTCH_DEPTH = 18; // distance from the bar's top edge to the bubble's centre
const GAP = 8; // empty ring between the bubble and the bar
const FILLET = 20; // how softly the notch blends into the bar's edge
const NOTCH_HALF_WIDTH = 50; // roughly how far the notch reaches either side of its centre
const ICON_SHIFT = BAR_THICKNESS / 2 - NOTCH_DEPTH; // the active icon slides this far up

// Animation settings (the same as the desktop sidebar)
const ANIMATION_MS = 550;
const BOUNCE = 0.7; // 0 = no overshoot, 1.5 = very bouncy

const easeOutBack = (t: number) => {
  const c3 = BOUNCE + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + BOUNCE * Math.pow(t - 1, 2);
};
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// ---------------------------------------------------------------------------
// Draws the outline of the bar as an SVG path.
//   width   = the bar's length
//   centerX = where the notch is (distance from the left end)
//   grow    = 0 (no notch, plain bar) ... 1 (full notch)
//
// The sidebar's shape is worked out for an upright bar, then every point is
// turned on its side with p(): (x, y) becomes (y, thickness - x).
// ---------------------------------------------------------------------------
function buildBarPath(width: number, centerX: number, grow: number): string {
  const T = BAR_THICKNESS;
  const r = CORNER;
  const p = (x: number, y: number) => `${y} ${T - x}`;

  const start = `M ${p(0, r)} A ${r} ${r} 0 0 1 ${p(r, 0)} L ${p(T - r, 0)} A ${r} ${r} 0 0 1 ${p(T, r)}`;
  const end = `L ${p(T, width - r)} A ${r} ${r} 0 0 1 ${p(T - r, width)} L ${p(r, width)} A ${r} ${r} 0 0 1 ${p(0, width - r)} Z`;

  // No notch: just the plain rounded bar
  if (grow < 0.02) return `${start} ${end}`;

  // Keep the notch away from the rounded corners
  const minC = r + NOTCH_HALF_WIDTH;
  const maxC = width - r - NOTCH_HALF_WIDTH;
  const ny = Math.min(Math.max(centerX, minC), Math.max(minC, maxC));

  const R = (BUBBLE / 2 + GAP) * grow; // radius of the notch circle
  const f = FILLET * grow; // radius of the soft corners
  const nx = T - NOTCH_DEPTH * grow; // depth of the notch circle's centre

  const fcx = T - f;
  const dy = Math.sqrt((R + f) ** 2 - (fcx - nx) ** 2);
  const k = f / (R + f);
  const tx = fcx + (nx - fcx) * k;
  const topY = ny - dy + dy * k;
  const bottomY = ny + dy - dy * k;

  return (
    `${start} L ${p(T, ny - dy)} ` +
    `A ${f} ${f} 0 0 1 ${p(tx, topY)} ` +
    `A ${R} ${R} 0 1 0 ${p(tx, bottomY)} ` +
    `A ${f} ${f} 0 0 1 ${p(T, ny + dy)} ` +
    end
  );
}

// ---------------------------------------------------------------------------
// Moves the notch smoothly to a new position every time targetX changes.
// targetX = null means "no active tab": the notch shrinks away.
// ---------------------------------------------------------------------------
function useAnimatedNotch(targetX: number | null) {
  const [notch, setNotch] = useState({ x: 0, grow: 0 });
  const current = useRef({ x: 0, grow: 0 });

  useEffect(() => {
    const from = { ...current.current };
    if (targetX !== null && from.grow < 0.02) from.x = targetX;
    const to = { x: targetX ?? from.x, grow: targetX === null ? 0 : 1 };

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const duration = reduceMotion ? 0 : ANIMATION_MS;
    const startTime = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min((now - startTime) / duration, 1);
      const next = {
        x: from.x + (to.x - from.x) * easeOutBack(t),
        grow: from.grow + (to.grow - from.grow) * easeOutCubic(t),
      };
      current.current = next;
      setNotch(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targetX]);

  return notch;
}

export default function MobileBottomBar() {
  const location = useLocation();
  const barRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const [barWidth, setBarWidth] = useState(0);
  const [activeX, setActiveX] = useState<number | null>(null);

  // Which tab is the current page? (pages like Settings have none)
  const activeIndex = tabs.findIndex((tab) =>
    tab.pages.some(
      (page) =>
        location.pathname === page || location.pathname.startsWith(`${page}/`)
    )
  );
  // Like the desktop sidebar, Home has no notch: it is the logo, not a tab
  const notchIndex = activeIndex > 0 ? activeIndex : -1;

  // Measure the bar and the active tab, and measure again if the screen resizes.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const measure = () => {
      setBarWidth(bar.offsetWidth);
      const tab = notchIndex >= 0 ? tabRefs.current[notchIndex] : null;
      setActiveX(tab ? tab.offsetLeft + tab.offsetWidth / 2 : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [notchIndex]);

  const notch = useAnimatedNotch(activeX);

  return (
    <div
      ref={barRef}
      className="fixed inset-x-3 z-40 h-16"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {/* The bar itself, drawn as a shape with a notch in it */}
      <svg
        aria-hidden="true"
        width={barWidth}
        height={BAR_THICKNESS}
        className="pointer-events-none absolute left-0 top-0 overflow-visible drop-shadow-lg"
      >
        <path
          d={buildBarPath(barWidth, notch.x, notch.grow)}
          style={{ fill: "var(--sidebar-bar)", transition: "fill 300ms" }}
        />
      </svg>

      {/* The bubble that sits in the notch */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-10 rounded-full bg-sidebar-primary shadow-md"
        style={{
          width: BUBBLE,
          height: BUBBLE,
          top: NOTCH_DEPTH - BUBBLE / 2,
          left: notch.x - BUBBLE / 2,
          opacity: Math.min(notch.grow * 2, 1),
          transform: `scale(${notch.grow})`,
        }}
      />

      {/* Logo + icons sit on top of the shape (icons only, no text) */}
      <nav
        aria-label="Main navigation"
        className="relative z-20 flex h-full items-center"
      >
        {tabs.map((tab, index) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            aria-label={tab.label}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            className={cn(
              "flex h-full items-center justify-center rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
              index === 0 ? "w-[68px] shrink-0" : "min-w-11 flex-1"
            )}
          >
            {tab.icon === null ? (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f4ede4]">
                <img
                  src="/lebid-wordmark.png"
                  alt=""
                  draggable={false}
                  className="w-9 select-none object-contain"
                />
              </span>
            ) : (
              <tab.icon
                className={cn(
                  "size-5 shrink-0 transition-[transform,color,opacity] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
                  index === notchIndex
                    ? "text-sidebar-primary-foreground"
                    : "text-(--sidebar-bar-foreground) opacity-70"
                )}
                style={{
                  transform:
                    index === notchIndex
                      ? `translateY(-${ICON_SHIFT}px)`
                      : undefined,
                }}
                strokeWidth={index === notchIndex ? 2.4 : 2}
              />
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}