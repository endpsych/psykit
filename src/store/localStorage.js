const PREFIX = 'psychdemo-';

export function load(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function save(key, value) {
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function remove(key) {
  window.localStorage.removeItem(PREFIX + key);
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function uploadJSON() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(JSON.parse(reader.result)); }
        catch { reject(new Error('Invalid JSON')); }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
