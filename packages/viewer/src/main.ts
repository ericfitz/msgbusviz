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

  (window as any).viewer = v;
}

void boot();
