// Two-pane product view shared by the item and the bundle detail.
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Icon } from '../icons';
import { reducedMotion } from './api';

gsap.registerPlugin(useGSAP);

/** Two-pane product view (like a game/Discord store): info and buy on the left, the item in context on the right. */
export function ProductDialog({ title, stage, children, onClose }: { title: string; stage: ReactNode; children: ReactNode; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (reducedMotion()) return;
    gsap.from('.js-veil', { autoAlpha: 0, duration: 0.2 });
    gsap.from('.js-panel', { y: 18, scale: 0.97, autoAlpha: 0, duration: 0.4, ease: 'power3.out' });
  }, { scope: root });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div ref={root} className="fixed inset-0 z-50 grid place-items-center p-3 md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Schließen" className="js-veil absolute inset-0 cursor-default border-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="js-panel relative grid h-[min(720px,100%)] w-[min(1120px,100%)] grid-rows-[minmax(260px,42%)_1fr] overflow-hidden rounded-[24px] border border-white/[.08] bg-surface shadow-[0_40px_120px_-30px_rgba(0,0,0,.9)] lg:grid-cols-[400px_1fr] lg:grid-rows-1">
        <div className="order-2 flex min-h-0 flex-col lg:order-1">{children}</div>
        <div className="order-1 min-h-0 lg:order-2">{stage}</div>
        <button type="button" aria-label="Schließen" onClick={onClose} className="icon-btn absolute right-3 top-3 z-10 bg-black/45 text-white backdrop-blur hover:bg-black/60"><span className="rotate-45"><Icon name="plus" size={18} /></span></button>
      </div>
    </div>
  );
}
