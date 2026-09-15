import type { Page } from '@playwright/test';

export interface SnapshotElement {
  role: string;
  name: string;
  tag: string;
}

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]'
].join(', ');

/**
 * Returns a compact list of visible interactive elements on the page so an
 * agent can decide what to click/fill without a screenshot.
 */
export async function snapshotPage(page: Page, limit = 60): Promise<SnapshotElement[]> {
  const handles = await page.locator(INTERACTIVE_SELECTOR).all();
  const results: SnapshotElement[] = [];

  for (const handle of handles) {
    if (results.length >= limit) break;

    const visible = await handle.isVisible().catch(() => false);
    if (!visible) continue;

    const [tag, role, name] = await Promise.all([
      handle.evaluate(el => el.tagName.toLowerCase()).catch(() => 'unknown'),
      handle.getAttribute('role').catch(() => null),
      handle.evaluate(el => {
        const aria = el.getAttribute('aria-label');
        if (aria) return aria;
        const placeholder = el.getAttribute('placeholder');
        const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
        return text || placeholder || '';
      }).catch(() => '')
    ]);

    const inferredRole = role ?? inferRole(tag);
    if (!name && inferredRole !== 'textbox') continue;

    const displayName = name || '(unlabeled input)';
    results.push({ role: inferredRole, name: displayName.slice(0, 80), tag });
  }

  return results;
}

function inferRole(tag: string): string {
  switch (tag) {
    case 'a':
      return 'link';
    case 'button':
      return 'button';
    case 'input':
    case 'textarea':
      return 'textbox';
    case 'select':
      return 'combobox';
    default:
      return 'generic';
  }
}
