/* Read-only, aggregate-only Apps Script client. No persistent storage or Sheet writes. */
(() => {
  'use strict';
  const core = CE186Availability;
  function endpointUrl(value) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value || '')) throw new Error('Inventory endpoint is not configured.');
    return new URL(value);
  }
  function load(endpoint, knownIds, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      let url;
      try { url = endpointUrl(endpoint); } catch (error) { reject(error); return; }
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const callback = '__ce186Inventory_' + [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
      const script = document.createElement('script');
      let timer, settled = false;
      function finish(error, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.remove();
        // A late network response should not throw after a timeout.
        window[callback] = () => {};
        setTimeout(() => { delete window[callback]; }, 60000);
        error ? reject(error) : resolve(value);
      }
      window[callback] = payload => {
        try { finish(null, core.validatePayload(payload, knownIds)); }
        catch (error) { finish(error); }
      };
      url.searchParams.set('callback', callback);
      // Distinct request on each load/retry. The service also reads Sheets afresh.
      url.searchParams.set('_', Date.now() + '-' + callback.slice(-16));
      script.src = url.href;
      script.referrerPolicy = 'no-referrer';
      script.onerror = () => finish(new Error('Inventory service could not be reached.'));
      timer = setTimeout(() => finish(new Error('Inventory service timed out.')), timeoutMs);
      document.head.appendChild(script);
    });
  }
  function demoAllowed(location) {
    return ['localhost','127.0.0.1','[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('inventory') === 'demo';
  }
  function demoPayload() {
    return {version:1, ok:true, read_at:new Date().toISOString(), requested:{arduino:12,ultrasonic:5,servo:7,resistors:3,'red-led':4}, uncertain_ids:[], review_count:0, matched_rows:5, team_count:9};
  }
  window.CE186InventoryClient = {load, endpointUrl, demoAllowed, demoPayload};
})();
