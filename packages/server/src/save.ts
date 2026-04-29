import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export function saveConfigYaml(filePath: string, configObject: unknown): void {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmp = path.join(dir, `.${base}.tmp-${process.pid}-${Date.now()}`);
  const body = yaml.dump(configObject, { lineWidth: 120, noRefs: true });
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, body);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, filePath);
}
