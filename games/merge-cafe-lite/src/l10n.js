/* 本地化：所有玩家可见文案只从 locale/en.json 取（构建时内联为 LOCALE）。
   DOM 里写 data-l10n="key"，启动时 L.apply() 统一填。 */
const L = (() => {
  const table = LOCALE;
  const missing = new Set();
  function t(key, vars) {
    let s = table[key];
    if (s === undefined) { if (!missing.has(key)) { missing.add(key); console.warn('[l10n] missing', key); } s = key; }
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return s;
  }
  function apply(root) { for (const el of (root || document).querySelectorAll('[data-l10n]')) el.textContent = t(el.dataset.l10n); }
  return { t, apply, missing };
})();
