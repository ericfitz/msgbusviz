import { Viewer } from './viewer.js';

async function boot(): Promise<void> {
  const container = document.getElementById('viz')!;
  const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  const search = new URLSearchParams(location.search);
  const editParam = search.get('edit') === '1';

  const v = new Viewer({
    container,
    config: '/config.json',
    baseUrl: location.origin,
    edit: editParam,
    ws: { url: wsUrl },
  });
  await v.ready();

  document.getElementById('btn-reset')?.addEventListener('click', () => v.resetView());
  document.getElementById('btn-fit')?.addEventListener('click', () => v.fitToGraph());
  document.getElementById('btn-labels')?.addEventListener('click', () => v.toggleLabels());

  if (editParam) {
    const btnSave = document.getElementById('btn-save') as HTMLButtonElement | null;
    const editPill = document.getElementById('edit-pill') as HTMLSpanElement | null;
    const statusEl = document.getElementById('status') as HTMLSpanElement | null;
    let statusClearTimer: ReturnType<typeof setTimeout> | null = null;
    const setStatus = (text: string, autoClear: boolean): void => {
      if (!statusEl) return;
      if (statusClearTimer) { clearTimeout(statusClearTimer); statusClearTimer = null; }
      statusEl.textContent = text;
      if (autoClear) {
        statusClearTimer = setTimeout(() => { statusEl.textContent = ''; statusClearTimer = null; }, 1500);
      }
    };
    if (btnSave) btnSave.hidden = false;
    if (editPill) editPill.hidden = false;
    btnSave?.addEventListener('click', () => v.save());
    window.addEventListener('keydown', (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return;
      const t = e.target;
      if (t instanceof HTMLElement && t.matches('input, textarea, [contenteditable], [contenteditable="true"]')) return;
      e.preventDefault();
      v.save();
    });
    v.onDirtyChange((dirty) => { if (btnSave) btnSave.dataset.dirty = String(dirty); });
    v.onSaveError((msg) => setStatus(msg, false));
    v.onSaveSuccess(() => setStatus('saved', true));
  }

  (window as Window & { viewer?: unknown }).viewer = v;
  (window as Window & { __viewerInternals?: unknown }).__viewerInternals = v.__internals();
}

void boot().catch((err) => {
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = `boot failed: ${(err as Error).message ?? String(err)}`;
  console.error('[viewer] boot failed', err);
});
