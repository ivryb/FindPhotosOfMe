import { onBeforeUnmount, ref, type Ref } from "vue";
import { useIntersectionObserver, useMediaQuery } from "@vueuse/core";
import type { MaybeElementRef } from "@vueuse/core";

type Phases<P extends string> = readonly (readonly [P, number])[];

/**
 * Plays timed phases once each time the element scrolls into view, e.g. [["idle", 500], ["ready", 0]].
 * With reduced motion it shows the last phase and stays there.
 */
export function usePhasesOnView<P extends string>(target: MaybeElementRef, phases: Phases<P>) {
  const phase = ref(phases[0]![0]) as Ref<P>;
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  let timers: ReturnType<typeof setTimeout>[] = [];
  const stop = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  useIntersectionObserver(target, ([entry]) => {
    stop();
    if (reducedMotion.value) {
      phase.value = phases.at(-1)![0];
      return;
    }
    if (!entry?.isIntersecting) return;
    let at = 0;
    timers = phases.map(([next, ms]) => {
      const timer = setTimeout(() => (phase.value = next), at);
      at += ms;
      return timer;
    });
  }, { threshold: 0.35 });

  onBeforeUnmount(stop);
  return phase;
}

/** Calls tick on an interval while the element is on screen; does nothing with reduced motion. */
export function useLoopOnView(target: MaybeElementRef, ms: number, tick: () => void) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => clearInterval(timer);

  useIntersectionObserver(target, ([entry]) => {
    stop();
    if (entry?.isIntersecting && !reducedMotion.value) timer = setInterval(tick, ms);
  }, { threshold: 0.3 });

  onBeforeUnmount(stop);
}

/** A number that counts up to a target over a few seconds, for "2,140 of 5,214 checked" style labels. */
export function useCountUp() {
  const count = ref(0);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  let frame = 0;

  function countTo(to: number, ms: number) {
    cancelAnimationFrame(frame);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = reducedMotion.value ? 1 : Math.min((now - start) / ms, 1);
      count.value = Math.round(to * progress);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    tick(start);
  }

  function set(to: number) {
    cancelAnimationFrame(frame);
    count.value = to;
  }

  onBeforeUnmount(() => cancelAnimationFrame(frame));
  return { count, countTo, set };
}

export const formatCount = (n: number) => n.toLocaleString("en-US");
