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
    if (btnSave) btnSave.hidden = false;
    if (editPill) editPill.hidden = false;
    btnSave?.addEventListener('click', () => v.save());
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); v.save(); }
    });
    v.onDirtyChange((dirty) => { if (btnSave) btnSave.dataset.dirty = String(dirty); });
    v.onSaveError((msg) => { if (statusEl) statusEl.textContent = msg; });
    v.onSaveSuccess(() => {
      if (!statusEl) return;
      statusEl.textContent = 'saved';
      setTimeout(() => { statusEl.textContent = ''; }, 1500);
    });
  }

  (window as Window & { viewer?: unknown }).viewer = v;
  (window as Window & { __viewerInternals?: unknown }).__viewerInternals = v.__internals();
}

void boot();
