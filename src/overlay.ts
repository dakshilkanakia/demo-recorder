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
      width: 28px;
      height: 28px;
      pointer-events: none;
      z-index: 2147483647;
      transform: translate(-2px, -2px);
      transition: left 0.5s cubic-bezier(0.4, 0, 0.2, 1), top 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      left: -100px;
      top: -100px;
      filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5));
    }
    #__demo-cursor.__demo-cursor-clicking {
      transition: left 0.5s cubic-bezier(0.4, 0, 0.2, 1), top 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.12s ease;
      transform: translate(-2px, -2px) scale(0.85);
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
  cursor.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M5 2 L5 22 L10.5 17.5 L14 25 L17.5 23.3 L14 16 L21 16 Z" ' +
    'fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>' +
    '</svg>';
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

    cursor.classList.add('__demo-cursor-clicking');
    setTimeout(() => cursor.classList.remove('__demo-cursor-clicking'), 150);
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
 * Draws a highlight box around the target element (cursor stays where it
 * was) and pauses, so the viewer sees what's about to be interacted with
 * before the cursor arrives. Call this first, then `moveCursorToElement`.
 */
export async function highlightOnly(page: Page, box: { x: number; y: number; width: number; height: number }) {
  await page
    .evaluate(
      ([bx, by, bw, bh]) => {
        window.__demoHighlightRect?.(bx, by, bw, bh);
      },
      [box.x, box.y, box.width, box.height]
    )
    .catch(() => undefined);

  await page.waitForTimeout(1000);
}

/**
 * Moves the fake cursor to the center of the given element's bounding box
 * and pauses briefly so the viewer sees it land before the action fires.
 * Safe to call even if the overlay script failed to install (no-ops).
 */
export async function moveCursorToElement(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page
    .evaluate(
      ([x, y]) => {
        window.__demoMoveCursor?.(x, y);
      },
      [centerX, centerY]
    )
    .catch(() => undefined);

  await page.waitForTimeout(500);
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
