// The Nexo logo: a turned walnut coin ("Holztaler") with the Nexo robot stuck on it as a die-cut sticker.
// Inline SVG so GSAP can animate the robot's parts: blinking, a pulsing antenna, chest lights and a moon that
// circles the orbit (in front of the head on the lower half, behind it above); the sticker itself floats gently.
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

/** Growth rings of the end grain: slightly wobbly circles around a heart a little off centre. */
const RINGS = Array.from({ length: 12 }, (_, i) => {
  const r = 40 + i * 36 + (i % 2) * 6;
  const points = Array.from({ length: 49 }, (_, k) => {
    const a = (k / 48) * Math.PI * 2;
    const wobble = 1 + Math.sin(a * 3 + i) * 0.025 + Math.sin(a * 7 + i * 2) * 0.012;
    return `${(530 + Math.cos(a) * r * wobble).toFixed(1)} ${(500 + Math.sin(a) * r * wobble * 0.96).toFixed(1)}`;
  });
  return { d: `M${points.join('L')}Z`, w: i % 3 ? 4 + (i % 2) * 3 : 10 };
});

/**
 * Drying cracks in the coin: a wedge from the rim towards the heart and one short hairline. They are holes (the
 * background shows through), drawn with a dark inner edge and a lit upper lip so they read as depth.
 */
const CRACKS = [
  { d: 'M887.5 179.5L883.8 189.2L872.6 195.0L870.3 207.1L855.8 207.3L848.3 221.8L845.5 229.9L837.5 238.9L827.1 244.3L822.4 247.6L815.3 260.0L806.8 265.6L798.9 272.5L792.3 284.8L786.1 292.6L778.6 297.8L770.3 303.9L764.9 313.8L755.0 317.5L746.8 326.1L739.2 333.9L732.3 341.3L724.0 347.9L716.2 355.3L709.7 364.0L702.1 371.2L695.4 379.5L685.5 384.0L679.8 394.2L680.9 394.8L686.3 384.9L696.3 380.7L704.4 373.7L712.5 366.8L720.7 360.1L729.1 354.1L737.0 347.1L746.8 341.7L752.8 332.6L762.1 329.5L771.3 323.4L782.1 319.7L791.5 314.2L799.4 305.0L806.9 296.0L813.2 290.6L825.4 289.2L829.8 277.0L841.9 279.8L854.4 270.8L856.5 257.9L866.1 255.2L878.4 248.5L884.2 245.7L890.3 238.1L902.9 235.1L910.5 230.6L923.6 227.6Z', lip: 'M887.5 179.5L883.8 189.2L872.6 195.0L870.3 207.1L855.8 207.3L848.3 221.8L845.5 229.9L837.5 238.9L827.1 244.3L822.4 247.6L815.3 260.0L806.8 265.6L798.9 272.5L792.3 284.8L786.1 292.6L778.6 297.8L770.3 303.9L764.9 313.8L755.0 317.5L746.8 326.1L739.2 333.9L732.3 341.3L724.0 347.9L716.2 355.3L709.7 364.0L702.1 371.2L695.4 379.5', main: true },
  { d: 'M81.7 767.2L87.0 764.0L91.9 760.3L96.7 757.3L101.8 754.6L107.5 752.5L113.1 748.8L117.6 744.9L124.1 743.0L127.1 735.8L131.4 733.4L137.3 732.2L143.2 728.8L147.3 723.7L151.9 720.4L157.2 717.8L163.1 716.0L168.4 713.2L174.8 712.1L179.3 707.6L184.1 704.0L183.4 703.0L178.5 706.7L174.3 711.0L168.0 711.9L162.3 713.9L156.5 715.8L150.7 718.1L145.3 721.5L141.1 726.1L135.9 727.5L129.3 728.4L123.8 733.1L120.0 738.2L114.8 739.9L110.3 744.5L104.7 745.5L99.1 747.7L92.9 749.5L87.2 752.4L82.0 755.1L76.6 757.3Z', lip: 'M81.7 767.2L87.0 764.0L91.9 760.3L96.7 757.3L101.8 754.6L107.5 752.5L113.1 748.8L117.6 744.9L124.1 743.0L127.1 735.8L131.4 733.4L137.3 732.2L143.2 728.8L147.3 723.7L151.9 720.4L157.2 717.8L163.1 716.0L168.4 713.2L174.8 712.1', main: false },
];

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
      gsap.to(q('.nx-sticker'), { y: -10, rotation: 1.5, svgOrigin: '512 512', duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
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
    <svg ref={root} className={className} viewBox="0 0 1024 1024" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`${id}-wood`} cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="#8A5A34" /><stop offset=".55" stopColor="#5E3A1F" /><stop offset="1" stopColor="#3A2212" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A8744A" /><stop offset=".5" stopColor="#6A4022" /><stop offset="1" stopColor="#2E1A0C" />
        </linearGradient>
        <clipPath id={`${id}-coin`}><circle cx="512" cy="512" r="452" /></clipPath>
        {/* Fine fibres of the wood, tinted brown. */}
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.06" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0 0.03  0 0 0 0.55 0" />
        </filter>
        <filter id={`${id}-lift`} x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#1A0E05" floodOpacity=".55" />
        </filter>
        {/* Gradients on ellipses in user space: the bot's renderer (banners, from nexo.svg) paints bounding-box
            gradients on ellipses black. Same look as the bounding box of each part. */}
        <linearGradient id={`${id}-eye`} gradientUnits="userSpaceOnUse" x1="0" y1="434" x2="0" y2="538">
          <stop offset="0" stopColor="#A78BFA" /><stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={`${id}-antenna`} gradientUnits="userSpaceOnUse" x1="0" y1="211" x2="0" y2="241">
          <stop offset="0" stopColor="#A78BFA" /><stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2A2066" /><stop offset="1" stopColor="#140F33" />
        </linearGradient>
        <linearGradient id={`${id}-orbit`} gradientUnits="userSpaceOnUse" x1={-ORBIT.rx} y1="0" x2={ORBIT.rx} y2="0">
          <stop offset="0" stopColor="#C4B5FD" stopOpacity="0" /><stop offset="0.3" stopColor="#C4B5FD" stopOpacity="0.6" /><stop offset="0.6" stopColor="#E9D5FF" stopOpacity="1" /><stop offset="1" stopColor="#7DD3FC" stopOpacity="1" />
        </linearGradient>
        <clipPath id={`${id}-front`}><rect x="-600" y="0" width="1200" height="600" /></clipPath>
        <mask id={`${id}-cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
          <rect width="1024" height="1024" fill="#FFFFFF" />
          {CRACKS.map((crack) => <path key={crack.main ? "main" : "hair"} d={crack.d} fill="#000000" />)}
        </mask>
        <clipPath id={`${id}-face`}><circle cx="512" cy="512" r="491" /></clipPath>
      </defs>

      {/* The coin: rim, end grain with growth rings, an engraved groove and a soft sheen; the cracks are cut out. */}
      <g mask={ref('cut')}>
      <circle cx="512" cy="512" r="492" fill={ref('rim')} />
      <circle cx="512" cy="512" r="452" fill={ref('wood')} />
      <g clipPath={ref('coin')}>
        {RINGS.map((ring, i) => <path key={i} d={ring.d} fill="none" stroke={i % 3 ? '#2E1A0C' : '#C08A5B'} strokeOpacity={i % 3 ? 0.28 : 0.16} strokeWidth={ring.w} />)}
        <rect x="0" y="0" width="1024" height="1024" filter={ref('grain')} opacity=".55" />
        <ellipse cx="380" cy="300" rx="300" ry="190" fill="#FFF3E0" opacity=".07" transform="rotate(-30 380 300)" />
      </g>
      <circle cx="512" cy="512" r="452" fill="none" stroke="#24140A" strokeOpacity=".55" strokeWidth="6" />
      <circle cx="512" cy="512" r="420" fill="none" stroke="#24140A" strokeOpacity=".45" strokeWidth="5" />
      <circle cx="512" cy="512" r="415" fill="none" stroke="#FFE7C7" strokeOpacity=".12" strokeWidth="3" />
      <circle cx="512" cy="512" r="490" fill="none" stroke="#FFE7C7" strokeOpacity=".18" strokeWidth="4" />
      <g clipPath={ref('face')}>
        {CRACKS.map((crack) => (
          <g key={crack.main ? "main" : "hair"}>
            <path d={crack.d} fill="none" stroke="#140A04" strokeOpacity=".55" strokeWidth={crack.main ? 12 : 6} strokeLinejoin="round" />
            <path d={crack.lip} fill="none" stroke="#E7B985" strokeOpacity={crack.main ? 0.5 : 0.35} strokeWidth={crack.main ? 4 : 2.5} strokeLinecap="round" transform="translate(-1.5 -1.5)" />
          </g>
        ))}
      </g>
      </g>

      {/* The robot as a die-cut sticker: a thick white cut line around its silhouette, lifted off the wood. */}
      <g className="nx-sticker">
      <g transform="translate(512 522) rotate(-7) scale(.82) translate(-512 -470)">
      <g filter={ref('lift')} fill="#FFFFFF" stroke="#FFFFFF" strokeLinejoin="round">
        <g transform={`translate(${ORBIT.cx} ${ORBIT.cy}) rotate(-10)`}><ellipse rx={ORBIT.rx} ry={ORBIT.ry} fill="none" strokeWidth="64" /></g>
        <rect x="497" y="236" width="30" height="80" rx="15" strokeWidth="50" />
        <circle cx="512" cy="226" r="27" strokeWidth="50" />
        <rect x="214" y="450" width="96" height="160" rx="46" strokeWidth="50" />
        <rect x="714" y="450" width="96" height="160" rx="46" strokeWidth="50" />
        <rect x="262" y="310" width="500" height="420" rx="150" strokeWidth="50" />
      </g>
      <g transform={`translate(${ORBIT.cx} ${ORBIT.cy}) rotate(-10)`} opacity="0.7">
        <ellipse rx={ORBIT.rx} ry={ORBIT.ry} fill="none" stroke={ref('orbit')} strokeWidth="14" />
      </g>
      <circle className="nx-moon-back" cx={start.x} cy={start.y} r="13" fill="#FFFFFF" opacity="0.6" />

      <g className="nx-body">
        <rect x="497" y="236" width="30" height="80" rx="15" fill="#FFFFFF" stroke="#CFC8F5" strokeWidth="8" />
        <circle cx="512" cy="226" r="27" fill="#FFFFFF" stroke="#CFC8F5" strokeWidth="8" />
        <circle className="nx-antenna-light" cx="512" cy="226" r="15" fill={ref('antenna')} />
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
      </g>
      </g>
    </svg>
  );
}
