/* Shared by the browser, Apps Script (Core.gs), and dependency-free tests. */
var CE186Availability = (() => {
  'use strict';
  const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  function itemId(value) {
    const match = /^https:\/\/scott-moura\.github\.io\/ce186\/materials\/?(?:\?[^#]*)?#(.+)$/i.exec(String(value || '').trim());
    if (!match) return null;
    try {
      const pairs = match[1].split('&').map(pair => {
        const i = pair.indexOf('=');
        return [decodeURIComponent(pair.slice(0, i)), decodeURIComponent(pair.slice(i + 1))];
      }).filter(pair => pair[0] === 'item');
      return pairs.length === 1 && ID.test(pairs[0][1]) ? pairs[0][1] : null;
    } catch { return null; }
  }
  function requestCount(value) {
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.0+)?$/.test(value.trim()))) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 && number <= 1e9 ? number : null;
  }
  function aggregate(sheets, knownIds) {
    const known = new Set(knownIds), requested = Object.create(null), uncertain = new Set(), issues = [];
    let matched = 0, teams = 0;
    for (const sheet of sheets) {
      if (!/^Team\s*[1-9]\d*$/i.test(sheet.name)) continue;
      teams++;
      for (const row of sheet.rows) {
        if (String(row.supplier || '').trim().toLowerCase().replace(/\s+/g, ' ') !== 'moura lab') continue;
        const count = requestCount(row.quantity);
        if (count === 0) continue;
        const id = itemId(row.url);
        let reason = null;
        if (!id) reason = 'missing_or_invalid_catalog_link';
        else if (!known.has(id)) reason = 'unknown_catalog_item';
        else if (count === null) { reason = 'invalid_quantity'; uncertain.add(id); }
        else {
          const total = (requested[id] || 0) + count;
          if (!Number.isSafeInteger(total) || total > 1e9) throw new Error('Quantity total exceeds supported range.');
          requested[id] = total;
          matched++;
        }
        if (reason) issues.push({sheet:sheet.name, row:row.row, reason});
      }
    }
    if (!teams) throw new Error('No team tabs found.');
    return {requested, uncertain_ids:[...uncertain], review_count:issues.length, matched_rows:matched, team_count:teams, issues};
  }
  function validatePayload(payload, knownIds, now = Date.now()) {
    if (!payload || payload.ok !== true || payload.version !== 1 || typeof payload.requested !== 'object' || !payload.requested || Array.isArray(payload.requested)) throw new Error('Invalid inventory response.');
    const readAt = Date.parse(payload.read_at);
    if (!Number.isFinite(readAt) || Math.abs(now - readAt) > 10 * 60 * 1000) throw new Error('Inventory response is out of date.');
    for (const field of ['review_count','matched_rows','team_count']) {
      if (!Number.isSafeInteger(payload[field]) || payload[field] < 0) throw new Error('Invalid inventory summary.');
    }
    if (payload.team_count < 1 || !Array.isArray(payload.uncertain_ids)) throw new Error('Incomplete inventory response.');
    const known = new Set(knownIds), totals = Object.create(null);
    let unknown = 0;
    for (const [id, count] of Object.entries(payload.requested)) {
      if (!ID.test(id) || typeof count !== 'number' || requestCount(count) === null) throw new Error('Invalid requested quantity.');
      if (!known.has(id)) { unknown++; continue; }
      totals[id] = count;
    }
    if (!payload.uncertain_ids.every(id => typeof id === 'string' && ID.test(id))) throw new Error('Invalid uncertain item.');
    return {requested:totals, uncertain:new Set(payload.uncertain_ids), readAt:new Date(readAt), reviewCount:payload.review_count + unknown};
  }
  function remaining(item, state) {
    if (!Number.isFinite(item.quantity)) return {text:'Not counted', value:null, negative:false};
    if (state.status === 'loading') return {text:'Loading…', value:null, negative:false};
    if (!['ready','demo'].includes(state.status) || state.uncertain?.has(item.id)) return {text:'Unavailable', value:null, negative:false};
    const value = item.quantity - (state.requested[item.id] || 0);
    return {text:String(value), value, negative:value < 0};
  }
  return {itemId, requestCount, aggregate, validatePayload, remaining};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CE186Availability;
