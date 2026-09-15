import type { Page } from '@playwright/test';

/**
 * Injects a fake cursor + highlight-box + click-ripple overlay into the page,
 * so recordings are watchable: viewers can see what's being clicked and
 * where the "mouse" is, since Playwright's real cursor is invisible on
 * video. Re-injected on every navigation (Playwright doesn't persist
 * injected DOM across page loads).
 */
const OVERLAY_SCRIPT = `
(() => {
  if (window.__demoOverlayInstalled) return;
  window.__demoOverlayInstalled = true;

  function install() {

  const style = document.createElement('style');
  style.textContent = \`
    #__demo-cursor {
      position: fixed;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(255, 60, 60, 0.9);
      border: 2px solid white;
      box-shadow: 0 0 6px rgba(0,0,0,0.5);
      pointer-events: none;
      z-index: 2147483647;
      transform: translate(-50%, -50%);
      transition: left 0.4s ease, top 0.4s ease;
      left: -100px;
      top: -100px;
    }
    #__demo-highlight {
      position: fixed;
      pointer-events: none;
      z-index: 2147483646;
      border: 3px solid #ff3c3c;
      border-radius: 6px;
      box-shadow: 0 0 0 4px rgba(255, 60, 60, 0.25);
      transition: all 0.25s ease;
      opacity: 0;
    }
    .__demo-ripple {
      position: fixed;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(255, 60, 60, 0.6);
      pointer-events: none;
      z-index: 2147483647;
      transform: translate(-50%, -50%);
      animation: __demo-ripple-anim 0.5s ease-out forwards;
    }
    @keyframes __demo-ripple-anim {
      from { width: 10px; height: 10px; opacity: 0.8; }
      to { width: 60px; height: 60px; opacity: 0; }
    }
  \`;
  document.head.appendChild(style);

  const cursor = document.createElement('div');
  cursor.id = '__demo-cursor';
  document.body.appendChild(cursor);

  const highlight = document.createElement('div');
  highlight.id = '__demo-highlight';
  document.body.appendChild(highlight);

  window.__demoMoveCursor = (x, y) => {
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
  };

  window.__demoHighlightRect = (x, y, w, h) => {
    highlight.style.left = (x - 4) + 'px';
    highlight.style.top = (y - 4) + 'px';
    highlight.style.width = (w + 8) + 'px';
    highlight.style.height = (h + 8) + 'px';
    highlight.style.opacity = '1';
  };

  window.__demoClearHighlight = () => {
    highlight.style.opacity = '0';
  };

  window.__demoRipple = (x, y) => {
    const r = document.createElement('div');
    r.className = '__demo-ripple';
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 550);
  };

  } // end install()

  if (document.body) {
    install();
  } else {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  }
})();
`;

declare global {
  interface Window {
    __demoOverlayInstalled?: boolean;
    __demoMoveCursor?: (x: number, y: number) => void;
    __demoHighlightRect?: (x: number, y: number, w: number, h: number) => void;
    __demoClearHighlight?: () => void;
    __demoRipple?: (x: number, y: number) => void;
  }
}

/**
 * Registers the overlay script to run on every navigation for this page
 * (Playwright's addInitScript persists across page.goto calls). Also runs it
 * immediately in case the page already has content loaded.
 */
export async function installOverlay(page: Page) {
  await page.addInitScript(OVERLAY_SCRIPT);
  await page.evaluate(OVERLAY_SCRIPT).catch(() => undefined);
}

/**
 * Moves the fake cursor to the center of the given element's bounding box,
 * draws a highlight box around it, briefly pauses so the highlight is
 * visible on camera, then clears the highlight and shows a click ripple.
 * Safe to call even if the overlay script failed to install (no-ops).
 */
export async function highlightElement(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page
    .evaluate(
      ([x, y, bx, by, bw, bh]) => {
        window.__demoMoveCursor?.(x, y);
        window.__demoHighlightRect?.(bx, by, bw, bh);
      },
      [centerX, centerY, box.x, box.y, box.width, box.height]
    )
    .catch(() => undefined);

  await page.waitForTimeout(350);
}

export async function showRippleAndClear(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page
    .evaluate(
      ([x, y]) => {
        window.__demoRipple?.(x, y);
        window.__demoClearHighlight?.();
      },
      [centerX, centerY]
    )
    .catch(() => undefined);
}
