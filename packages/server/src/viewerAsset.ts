const STUB_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>msgbusviz</title></head>
<body><h1>msgbusviz viewer not built</h1>
<p>Run <code>npm run build -w @msgbusviz/viewer</code>.</p>
<script src="/viewer.js"></script>
</body></html>`;

const STUB_JS = `console.warn('msgbusviz viewer bundle not built');`;

export function loadViewerHtml(): string { return STUB_HTML; }
export function loadViewerJs(): string { return STUB_JS; }
