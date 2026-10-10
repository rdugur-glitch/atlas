import { useEffect } from 'react';

/** iOS keeps the layout viewport tall while its keyboard shrinks the visual one. */
export function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = viewport?.height ?? window.innerHeight;
        const top = viewport?.offsetTop ?? 0;
        const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
        const inset = Math.max(0, window.innerHeight - height - top);
        const keyboard = window.innerWidth < 768 && editing && inset > 100;
        const root = document.documentElement;
        root.style.setProperty('--visible-height', `${height}px`);
        root.style.setProperty('--visible-top', `${top}px`);
        root.style.setProperty('--keyboard-inset', keyboard ? `${inset}px` : '0px');
        root.dataset.keyboardOpen = keyboard ? 'true' : 'false';
      });
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
}
