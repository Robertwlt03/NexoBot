// The Nexo robot as inline SVG so GSAP can animate its parts: floating, blinking, a pulsing antenna,
// chest lights and a moon that circles the orbit (in front of the head on the lower half, behind it above).
import { useId, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface NexoLogoProps {
  className?: string;
  /** idle animation (float, blink, orbit); off for tiny icons */
  animated?: boolean;
  /** eyes follow the mouse pointer */
  followPointer?: boolean;
  title?: string;
}

// Orbit ellipse: centre, radii and tilt in SVG units.
const ORBIT = { cx: 512, cy: 560, rx: 400, ry: 88, tilt: (-10 * Math.PI) / 180 };

function orbitPoint(angle: number) {
  const x = ORBIT.rx * Math.cos(angle);
  const y = ORBIT.ry * Math.sin(angle);
  return {
    x: ORBIT.cx + x * Math.cos(ORBIT.tilt) - y * Math.sin(ORBIT.tilt),
    y: ORBIT.cy + x * Math.sin(ORBIT.tilt) + y * Math.cos(ORBIT.tilt),
    front: Math.sin(angle) > 0,
  };
}

export function NexoLogo({ className, animated = true, followPointer = false, title = 'Nexo' }: NexoLogoProps) {
  const root = useRef<SVGSVGElement>(null);
  const id = useId().replace(/:/g, '');
  const ref = (name: string) => `url(#${id}-${name})`;

  useGSAP(() => {
    if (!animated) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const q = gsap.utils.selector(root);
      gsap.to(q('.nx-body'), { y: -14, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to(q('.nx-antenna-light'), { scale: 1.35, transformOrigin: '50% 50%', duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to(q('.nx-eye'), { scaleY: 0.08, transformOrigin: '50% 50%', duration: 0.09, yoyo: true, repeat: -1, repeatDelay: 3.4, ease: 'power1.in' });
      gsap.fromTo(q('.nx-light'), { opacity: 0.25 }, { opacity: 1, duration: 0.5, stagger: { each: 0.25, repeat: -1, yoyo: true } });

      const back = q('.nx-moon-back')[0];
      const front = q('.nx-moon-front')[0];
      const moon = { angle: -0.4 };
      gsap.to(moon, {
        angle: -0.4 + Math.PI * 2, duration: 7, ease: 'none', repeat: -1,
        onUpdate: () => {
          const p = orbitPoint(moon.angle);
          gsap.set([back, front], { attr: { cx: p.x, cy: p.y } });
          gsap.set(front, { opacity: p.front ? 0.95 : 0 });
          gsap.set(back, { opacity: p.front ? 0 : 0.6 });
        },
      });

      if (followPointer) {
        const moveX = gsap.quickTo(q('.nx-pupils'), 'x', { duration: 0.4, ease: 'power3' });
        const moveY = gsap.quickTo(q('.nx-pupils'), 'y', { duration: 0.4, ease: 'power3' });
        const onMove = (event: PointerEvent) => {
          const box = root.current?.getBoundingClientRect();
          if (!box) return;
          const dx = (event.clientX - (box.left + box.width / 2)) / window.innerWidth;
          const dy = (event.clientY - (box.top + box.height / 2)) / window.innerHeight;
          moveX(gsap.utils.clamp(-1, 1, dx * 2) * 18);
          moveY(gsap.utils.clamp(-1, 1, dy * 2) * 14);
        };
        window.addEventListener('pointermove', onMove);
        return () => window.removeEventListener('pointermove', onMove);
      }
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [animated, followPointer] });

  const start = orbitPoint(-0.4);

  return (
    <svg ref={root} className={className} viewBox="90 160 844 600" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-eye`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A78BFA" /><stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2A2066" /><stop offset="1" stopColor="#140F33" />
        </linearGradient>
        <linearGradient id={`${id}-orbit`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C4B5FD" stopOpacity="0" /><stop offset="0.3" stopColor="#C4B5FD" stopOpacity="0.6" /><stop offset="0.6" stopColor="#E9D5FF" stopOpacity="1" /><stop offset="1" stopColor="#7DD3FC" stopOpacity="1" />
        </linearGradient>
        <clipPath id={`${id}-front`}><rect x="-600" y="0" width="1200" height="600" /></clipPath>
      </defs>

      <g transform={`translate(${ORBIT.cx} ${ORBIT.cy}) rotate(-10)`} opacity="0.7">
        <ellipse rx={ORBIT.rx} ry={ORBIT.ry} fill="none" stroke={ref('orbit')} strokeWidth="14" />
      </g>
      <circle className="nx-moon-back" cx={start.x} cy={start.y} r="13" fill="#FFFFFF" opacity="0.6" />

      <g className="nx-body">
        <rect x="497" y="236" width="30" height="80" rx="15" fill="#FFFFFF" stroke="#CFC8F5" strokeWidth="8" />
        <circle cx="512" cy="226" r="27" fill="#FFFFFF" stroke="#CFC8F5" strokeWidth="8" />
        <circle className="nx-antenna-light" cx="512" cy="226" r="15" fill={ref('eye')} />
        <rect x="214" y="450" width="96" height="160" rx="46" fill="#E6E4FB" stroke="#CFC8F5" strokeWidth="8" />
        <rect x="714" y="450" width="96" height="160" rx="46" fill="#E6E4FB" stroke="#CFC8F5" strokeWidth="8" />
        <rect x="262" y="310" width="500" height="420" rx="150" fill="#FFFFFF" stroke="#CFC8F5" strokeWidth="8" />
        <rect x="325" y="395" width="375" height="205" rx="102" fill={ref('visor')} />
        <g className="nx-pupils">
          <g className="nx-eye">
            <ellipse cx="426" cy="486" rx="44" ry="52" fill={ref('eye')} />
            <circle cx="442" cy="466" r="13" fill="#F5F3FF" />
          </g>
          <g className="nx-eye">
            <ellipse cx="598" cy="486" rx="44" ry="52" fill={ref('eye')} />
            <circle cx="614" cy="466" r="13" fill="#F5F3FF" />
          </g>
        </g>
        <path d="M 452 552 Q 512 592 572 552" fill="none" stroke="#22D3EE" strokeWidth="15" strokeLinecap="round" />
        <circle className="nx-light" cx="452" cy="672" r="11" fill="#C4B5FD" />
        <circle className="nx-light" cx="512" cy="672" r="11" fill="#67E8F9" />
        <circle className="nx-light" cx="572" cy="672" r="11" fill="#D8B4FE" />
      </g>

      <g transform={`translate(${ORBIT.cx} ${ORBIT.cy}) rotate(-10)`} clipPath={ref('front')}>
        <ellipse rx={ORBIT.rx} ry={ORBIT.ry} fill="none" stroke={ref('orbit')} strokeWidth="14" />
      </g>
      <circle className="nx-moon-front" cx={start.x} cy={start.y} r="13" fill="#FFFFFF" opacity="0" />
    </svg>
  );
}
