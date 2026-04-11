import { load, save, downloadJSON } from './localStorage';

const KEY = 'item-bank';

let listeners = [];

function notify() {
  listeners.forEach(fn => fn());
}

export function subscribe(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function loadBank() {
  return load(KEY, []);
}

export function saveBank(items) {
  save(KEY, items);
  notify();
}

export function appendToBank(newItems) {
  const bank = loadBank();
  bank.push(...newItems);
  saveBank(bank);
  return bank;
}

export function removeFromBank(id) {
  const bank = loadBank().filter(i => i.id !== id);
  saveBank(bank);
  return bank;
}

export function removeManyFromBank(ids) {
  const set = new Set(ids);
  const bank = loadBank().filter(i => !set.has(i.id));
  saveBank(bank);
  return bank;
}

export function exportBank() {
  downloadJSON(loadBank(), 'psychometric-item-bank.json');
}

export function genBankId(prefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${code}`;
}

export function makeBankItem(partial) {
  const now = new Date().toISOString();
  return {
    id: partial.id || genBankId(partial.generatedBy || 'item'),
    name: partial.name || partial.id || 'Untitled',
    stem: partial.stem || '',
    generatedBy: partial.generatedBy || 'manual',
    constructId: partial.constructId || '',
    responseFormat: partial.responseFormat || 'mc',
    responseOptions: partial.responseOptions || [],
    difficulty: partial.difficulty || null,
    qualityFlags: partial.qualityFlags || [],
    status: 'draft',
    generatorMeta: partial.generatorMeta || {},
    notes: partial.notes || '',
    createdAt: now,
    ...partial,
    createdAt: partial.createdAt || now,
  };
}
