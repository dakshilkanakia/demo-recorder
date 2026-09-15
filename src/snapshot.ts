import type { Page } from '@playwright/test';

export interface SnapshotElement {
  role: string;
  name: string;
  tag: string;
  /** 0-based index among elements sharing the same role+name; use with `nth` on click/fill to disambiguate duplicates. */
  nth: number;
}

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="combobox"]',
  '[role="menuitem"]'
].join(', ');

/**
 * Returns a compact list of visible interactive elements on the page so an
 * agent can decide what to click/fill without a screenshot.
 */
export async function snapshotPage(page: Page, limit = 60): Promise<SnapshotElement[]> {
  const handles = await page.locator(INTERACTIVE_SELECTOR).all();
  const results: SnapshotElement[] = [];
  const seenKeyCounts = new Map<string, number>();

  for (const handle of handles) {
    if (results.length >= limit) break;

    const visible = await handle.isVisible().catch(() => false);
    if (!visible) continue;

    const [tag, explicitRole, inputType, name, ariaValue] = await Promise.all([
      handle.evaluate(el => el.tagName.toLowerCase()).catch(() => 'unknown'),
      handle.getAttribute('role').catch(() => null),
      handle.getAttribute('type').catch(() => null),
      handle.evaluate(el => {
        const aria = el.getAttribute('aria-label');
        if (aria) return aria;
        const placeholder = el.getAttribute('placeholder');
        const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
        return text || placeholder || '';
      }).catch(() => ''),
      handle
        .evaluate(el => el.getAttribute('aria-valuenow') ?? el.getAttribute('value'))
        .catch(() => null)
    ]);

    const inferredRole = explicitRole ?? inferRole(tag, inputType);
    if (!name && !['textbox', 'checkbox', 'radio', 'slider', 'switch'].includes(inferredRole)) {
      continue;
    }

    let displayName = name || '(unlabeled input)';
    if (inferredRole === 'slider' && ariaValue) {
      displayName = `${displayName} (current value: ${ariaValue})`;
    }
    displayName = displayName.slice(0, 80);

    const key = `${inferredRole}::${displayName}`;
    const nth = seenKeyCounts.get(key) ?? 0;
    seenKeyCounts.set(key, nth + 1);

    results.push({ role: inferredRole, name: displayName, tag, nth });
  }

  return results;
}

function inferRole(tag: string, inputType: string | null): string {
  if (tag === 'input') {
    if (inputType === 'checkbox') return 'checkbox';
    if (inputType === 'radio') return 'radio';
    if (inputType === 'range') return 'slider';
    return 'textbox';
  }
  switch (tag) {
    case 'a':
      return 'link';
    case 'button':
      return 'button';
    case 'textarea':
      return 'textbox';
    case 'select':
      return 'combobox';
    default:
      return 'generic';
  }
}
