// One crossfade per theme switch. All DOM updates of a switch (CSS variables, React state, the previews in iframes)
// run inside a single view transition: the browser blends a snapshot of the old look into the new one on the GPU,
// instead of animating colours on thousands of elements (which stuttered, worst on the overview's 38 previews).
// Previews inside an overview switch instantly; the overview's own transition already covers them.

type Update = () => void | Promise<void>;

const pending: Update[] = [];
let busy = false;

/** In an overview's preview or the phone frame (an iframe inside the preview). */
export const nested = window.parent !== window.top;
const crossfades = () => !nested && 'startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Runs the queued updates side by side; updates may queue more (their React commits run layout effects that queue the
 * previews' updates), so repeat until none are left. Microtasks, not timers: timers are throttled in hidden windows.
 */
async function runPending() {
  while (pending.length) {
    await Promise.all(pending.splice(0).map((update) => update()));
    await Promise.resolve();
  }
}

/**
 * Queues a DOM update of the current switch. The first one starts the transition; its callback runs after the browser
 * took the snapshot of the old look, so updates queued until then (in the same render) still land in the same fade.
 */
export function inTransition(update: Update) {
  pending.push(update);
  if (busy) return;
  busy = true;
  // An update queued after the last round but before this point would wait for the next switch: run it now.
  const done = () => {
    busy = false;
    const next = pending.shift();
    if (next) inTransition(next);
  };
  if (!crossfades()) {
    // After the current render, not in it: the updates set React state.
    queueMicrotask(() => void runPending().finally(done));
    return;
  }
  document.startViewTransition(runPending).updateCallbackDone.catch(() => undefined).finally(done);
}
