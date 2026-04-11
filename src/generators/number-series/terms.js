/* ---------------------------------------------------------------
   terms.js  --  Term representation & arithmetic for Number Series
   Two term kinds:
     { kind: 'fraction', n, d }   (integers have d = 1)
     { kind: 'surd',  coeff, rad }  (coeff * sqrt(rad))
   --------------------------------------------------------------- */

// ---------- helpers ----------

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

// ---------- constructors / simplifiers ----------

export function simplifyFraction(n, d) {
  if (d === 0) return { kind: 'fraction', n: NaN, d: 1 };
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d);
  return { kind: 'fraction', n: n / g, d: d / g };
}

export function simplifySurd(coeff, rad) {
  if (rad < 0) return { kind: 'surd', coeff: NaN, rad: 1 };
  if (rad === 0) return { kind: 'fraction', n: 0, d: 1 };
  // extract perfect-square factors
  let outer = coeff;
  let inner = rad;
  for (let f = 2; f * f <= inner; f++) {
    while (inner % (f * f) === 0) {
      inner /= f * f;
      outer *= f;
    }
  }
  // if radical collapsed to 1, it is an integer
  if (inner === 1) return { kind: 'fraction', n: outer, d: 1 };
  return { kind: 'surd', coeff: outer, rad: inner };
}

export function frac(n, d) { return simplifyFraction(n, d ?? 1); }
export function surd(coeff, rad) { return simplifySurd(coeff, rad); }
export function integer(n) { return { kind: 'fraction', n, d: 1 }; }

// ---------- arithmetic ----------

export function addTerms(a, b) {
  // only fraction + fraction supported (surd addition is complex and not needed for series)
  if (a.kind === 'fraction' && b.kind === 'fraction') {
    return simplifyFraction(a.n * b.d + b.n * a.d, a.d * b.d);
  }
  if (a.kind === 'surd' && b.kind === 'surd' && a.rad === b.rad) {
    return simplifySurd(a.coeff + b.coeff, a.rad);
  }
  // fallback: approximate as fraction
  const val = termValue(a) + termValue(b);
  return { kind: 'fraction', n: Math.round(val * 1000), d: 1000 };
}

export function multiplyTerms(a, b) {
  if (a.kind === 'fraction' && b.kind === 'fraction') {
    return simplifyFraction(a.n * b.n, a.d * b.d);
  }
  if (a.kind === 'fraction' && b.kind === 'surd') {
    return simplifySurd(a.n * b.coeff, b.rad);
  }
  if (a.kind === 'surd' && b.kind === 'fraction') {
    return simplifySurd(a.coeff * b.n, a.rad);
  }
  // surd * surd
  if (a.kind === 'surd' && b.kind === 'surd') {
    // coeff1*coeff2 * sqrt(rad1*rad2)
    return simplifySurd(a.coeff * b.coeff, a.rad * b.rad);
  }
  return integer(0);
}

export function subtractTerms(a, b) {
  if (b.kind === 'fraction') return addTerms(a, { kind: 'fraction', n: -b.n, d: b.d });
  if (b.kind === 'surd') return addTerms(a, { kind: 'surd', coeff: -b.coeff, rad: b.rad });
  return addTerms(a, b);
}

export function divideTerms(a, b) {
  if (b.kind === 'fraction' && b.n !== 0) {
    // invert b
    return multiplyTerms(a, simplifyFraction(b.d, b.n));
  }
  // rough fallback
  const val = termValue(a) / termValue(b);
  if (!isFinite(val)) return { kind: 'fraction', n: NaN, d: 1 };
  return { kind: 'fraction', n: Math.round(val * 1000), d: 1000 };
}

// ---------- display / comparison ----------

export function displayTerm(term) {
  if (!term) return '?';
  if (term.kind === 'surd') {
    if (term.coeff === 0) return '0';
    const sign = term.coeff < 0 ? '-' : '';
    const c = Math.abs(term.coeff);
    const cStr = c === 1 ? '' : String(c);
    return `${sign}${cStr}\u221A${term.rad}`;
  }
  // fraction
  if (!isFinite(term.n)) return 'NaN';
  if (term.d === 1) return String(term.n);
  const sign = (term.n < 0) !== (term.d < 0) ? '-' : '';
  return `${sign}${Math.abs(term.n)}/${Math.abs(term.d)}`;
}

export function parseDisplayTerm(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const normalized = value.replace(/\s+/g, '');

  if (/^-?\d+$/.test(normalized)) {
    return integer(Number(normalized));
  }

  const fractionMatch = normalized.match(/^(-?\d+)\/(\d+)$/);
  if (fractionMatch) {
    return frac(Number(fractionMatch[1]), Number(fractionMatch[2]));
  }

  const surdMatch = normalized.match(/^(-?)(\d*)√(\d+)$/);
  if (surdMatch) {
    const sign = surdMatch[1] === '-' ? -1 : 1;
    const coeff = surdMatch[2] ? Number(surdMatch[2]) : 1;
    return surd(sign * coeff, Number(surdMatch[3]));
  }

  return null;
}

export function termValue(term) {
  if (!term) return NaN;
  if (term.kind === 'surd') return term.coeff * Math.sqrt(term.rad);
  return term.n / term.d;
}

export function termsEqual(a, b) {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'fraction') return a.n === b.n && a.d === b.d;
  return a.coeff === b.coeff && a.rad === b.rad;
}
