import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  GraduationCap,
  CalendarClock,
  Library,
  BookOpen,
  AlertCircle,
  Calendar,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { label: "Timetable", to: "/timetable", icon: CalendarDays },
  { label: "Study Planner", to: "/planner", icon: CalendarClock },
  { label: "Tasks", to: "/tasks", icon: ClipboardList },
  { label: "Assignments", to: "/assignments", icon: BookOpen },
  { label: "Exams", to: "/exams", icon: GraduationCap },
  { label: "Events", to: "/events", icon: Calendar },
  { label: "Courses", to: "/courses", icon: Library },

  { label: "Conflict Checker", to: "/conflicts", icon: AlertCircle },
];

// ---------------------------------------------------------------------------
// The shape of the bar (all sizes in pixels). Change these to restyle it.
// ---------------------------------------------------------------------------
const BAR_WIDTH = 64; // the dark bar
const SVG_WIDTH = 76; // bar + the bit of the bubble that sticks out
const CORNER = 24; // rounded corners of the bar
const BUBBLE = 44; // diameter of the highlighted circle
const BUBBLE_CENTER_X = 46; // distance from the bar's left edge to the bubble's centre
const GAP = 8; // empty ring between the bubble and the bar
const FILLET = 20; // how softly the notch blends into the bar's edge
const NOTCH_HALF_HEIGHT = 50; // roughly how far the notch reaches above/below its centre
const ICON_SHIFT = BUBBLE_CENTER_X - BAR_WIDTH / 2; // the active icon slides this far right

// Animation settings
const ANIMATION_MS = 550;
const BOUNCE = 0.7; // 0 = no overshoot, 1.5 = very bouncy

// Easing functions: they turn "time 0 to 1" into "movement 0 to 1"
const easeOutBack = (t: number) => {
  const c3 = BOUNCE + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + BOUNCE * Math.pow(t - 1, 2);
};
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// ---------------------------------------------------------------------------
// Draws the outline of the bar as an SVG path.
//   centerY = where the notch is (distance from the top of the bar)
//   grow    = 0 (no notch, plain bar) ... 1 (full notch)
// The notch is a circle cut out of the bar's right edge, with soft rounded
// corners where it meets the edge.
// ---------------------------------------------------------------------------
function buildBarPath(height: number, centerY: number, grow: number): string {
  const W = BAR_WIDTH;
  const r = CORNER;

  const top = `M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 H ${W - r} A ${r} ${r} 0 0 1 ${W} ${r}`;
  const bottom = `V ${height - r} A ${r} ${r} 0 0 1 ${W - r} ${height} H ${r} A ${r} ${r} 0 0 1 0 ${height - r} Z`;

  // No notch: just the plain rounded bar
  if (grow < 0.02) return `${top} ${bottom}`;

  // Keep the notch away from the rounded corners
  const minY = r + NOTCH_HALF_HEIGHT;
  const maxY = height - r - NOTCH_HALF_HEIGHT;
  const ny = Math.min(Math.max(centerY, minY), Math.max(minY, maxY));

  // Everything is scaled around the point (W, ny) so the notch can "grow" in
  const R = (BUBBLE / 2 + GAP) * grow; // radius of the notch circle
  const f = FILLET * grow; // radius of the soft corners
  const nx = W - (W - BUBBLE_CENTER_X) * grow; // x of the notch circle's centre

  const fcx = W - f; // x of the soft corners' centre
  const dy = Math.sqrt((R + f) ** 2 - (fcx - nx) ** 2);
  const k = f / (R + f);
  const tx = fcx + (nx - fcx) * k; // where soft corner meets notch circle
  const topY = ny - dy + dy * k;
  const bottomY = ny + dy - dy * k;

  return (
    `${top} V ${ny - dy} ` +
    `A ${f} ${f} 0 0 1 ${tx} ${topY} ` +
    `A ${R} ${R} 0 1 0 ${tx} ${bottomY} ` +
    `A ${f} ${f} 0 0 1 ${W} ${ny + dy} ` +
    bottom
  );
}

// ---------------------------------------------------------------------------
// Moves the notch smoothly to a new position every time targetY changes.
// targetY = null means "no active item": the notch shrinks away.
// ---------------------------------------------------------------------------
function useAnimatedNotch(targetY: number | null) {
  const [notch, setNotch] = useState({ y: 0, grow: 0 });
  const current = useRef({ y: 0, grow: 0 });

  useEffect(() => {
    const from = { ...current.current };
    // If there is no notch yet, it appears right at the target and grows.
    if (targetY !== null && from.grow < 0.02) from.y = targetY;
    const to = { y: targetY ?? from.y, grow: targetY === null ? 0 : 1 };

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const duration = reduceMotion ? 0 : ANIMATION_MS;
    const startTime = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min((now - startTime) / duration, 1);
      const next = {
        y: from.y + (to.y - from.y) * easeOutBack(t),
        grow: from.grow + (to.grow - from.grow) * easeOutCubic(t),
      };
      current.current = next;
      setNotch(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targetY]);

  return notch;
}

export default function Sidebar() {
  const location = useLocation();
  const barRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const [barHeight, setBarHeight] = useState(0);
  const [activeY, setActiveY] = useState<number | null>(null);

  // Which item is the current page? (pages like Settings have none)
  const activeIndex = navItems.findIndex(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`)
  );

  // Measure the bar and the active icon, and measure again if the window resizes.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const measure = () => {
      setBarHeight(bar.offsetHeight);
      const item = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
      setActiveY(item ? item.offsetTop + item.offsetHeight / 2 : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [activeIndex]);

  const notch = useAnimatedNotch(activeY);

  return (
    <aside className="sticky top-0 h-screen w-22 shrink-0 overflow-y-auto overflow-x-hidden py-3 pl-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* min-h keeps all icons readable; on very short windows the bar scrolls */}
      <div ref={barRef} className="relative h-full min-h-[520px] w-16">
        {/* The bar itself, drawn as a shape with a notch in it */}
        <svg
          aria-hidden="true"
          width={SVG_WIDTH}
          height={barHeight}
          className="pointer-events-none absolute left-0 top-0 overflow-visible drop-shadow-lg"
        >
          <path
            d={buildBarPath(barHeight, notch.y, notch.grow)}
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
            left: BUBBLE_CENTER_X - BUBBLE / 2,
            top: notch.y - BUBBLE / 2,
            opacity: Math.min(notch.grow * 2, 1),
            transform: `scale(${notch.grow})`,
          }}
        />

        {/* Logo + icons sit on top of the shape */}
        <div className="relative z-20 flex h-full flex-col">
          {/* Brand */}
          <div className="flex shrink-0 justify-center pt-3.5">
            <NavLink
              to="/dashboard"
              aria-label="Lebid Dashboard"
              title="Lebid"
              className="flex size-11 items-center justify-center rounded-full bg-[#f4ede4] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
            >
              <img
                src="/favicon.png"
                alt="Lebid"
                draggable={false}
                className="size-8 select-none object-contain"
              />
            </NavLink>
          </div>

          {/* Navigation */}
          <nav
            aria-label="Main navigation"
            className="mt-3.5 flex flex-1 flex-col pb-14"
          >
            {navItems.map((item, index) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                className="group flex min-h-11 flex-1 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        "size-5 shrink-0 transition-[transform,color,opacity,scale] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
                        isActive
                          ? "text-sidebar-primary-foreground"
                          : "text-(--sidebar-bar-foreground) opacity-70 group-hover:scale-110 group-hover:opacity-100"
                      )}
                      style={{
                        transform: isActive
                          ? `translateX(${ICON_SHIFT}px)`
                          : undefined,
                      }}
                      strokeWidth={isActive ? 2.4 : 2}
                    />
                    <span className="sr-only">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}