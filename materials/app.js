(() => {
  'use strict';
  const data = window.CE186_CATALOG;
  const grid = document.querySelector('#product-grid');
  const results = document.querySelector('#results-count');
  if (!data || !Array.isArray(data.items)) {
    results.textContent = 'The catalog could not load. Download the item list or reload this page.';
    return;
  }
  const items = data.items;
  const search = document.querySelector('#search');
  const sort = document.querySelector('#sort');
  const filters = document.querySelector('#category-filters');
  const reset = document.querySelector('#reset-filters');
  const clearSearch = document.querySelector('#clear-search');
  const empty = document.querySelector('#empty-state');
  const dialog = document.querySelector('#item-dialog');
  const detail = document.querySelector('#detail-content');
  const byId = new Map(items.map(item => [item.id, item]));
  const categoryOrder = ['Controllers', 'Sensors', 'Actuators', 'Displays & inputs', 'Power & cables', 'Prototyping'];
  const categories = [...new Set(items.map(item => item.category))].sort((a, b) => {
    const ai = categoryOrder.indexOf(a), bi = categoryOrder.indexOf(b);
    return (ai === -1 ? 100 : ai) - (bi === -1 ? 100 : bi) || a.localeCompare(b);
  });
  const iconNames = {'Controllers':'chip','Sensors':'sensor','Actuators':'motor','Displays & inputs':'display','Power & cables':'power','Prototyping':'tools'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#${name}"></use></svg>`;
  const normalize = text => String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const safeUrl = value => {
    try { const url = new URL(value); return url.protocol === 'https:' ? escape(url.href) : ''; }
    catch { return ''; }
  };
  const searchable = new Map(items.map(item => [item.id, normalize([item.name, item.category, item.model, item.description, item.keywords, item.interface].join(' '))]));
  let category = 'All materials';
  let lastOpener = null;
  let currentItem = null;
  const unitFor = item => item.quantity === 1 ? item.unit.replace(/s$/, '') : item.unit;
  const quantity = item => `${item.quantity} ${unitFor(item)}`;
  const image = (item, className = 'product-photo') => safeUrl(item.image_url) ? `<img class="${className}" src="${safeUrl(item.image_url)}" alt="${escape(item.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span class="photo-fallback">${icon(iconNames[item.category] || 'grid')}<span>Photo unavailable</span></span>`;

  function installImageFallbacks(scope) {
    for (const img of scope.querySelectorAll('img')) {
      img.addEventListener('error', () => {
        const fallback = document.createElement('span');
        fallback.className = 'photo-fallback';
        fallback.innerHTML = `${icon('grid')}<span>Photo unavailable</span>`;
        img.replaceWith(fallback);
      }, {once:true});
    }
  }
  function updateUrl() {
    const url = new URL(location.href);
    const query = search.value.trim();
    query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
    category !== 'All materials' ? url.searchParams.set('category', category) : url.searchParams.delete('category');
    sort.value !== 'recommended' ? url.searchParams.set('sort', sort.value) : url.searchParams.delete('sort');
    history.replaceState(null, '', url);
  }
  function renderCategories() {
    filters.innerHTML = ['All materials', ...categories].map(name => {
      const count = name === 'All materials' ? items.length : items.filter(item => item.category === name).length;
      return `<button class="category-button" type="button" data-category="${escape(name)}" aria-pressed="${name === category}">${icon(iconNames[name] || 'grid')}<span>${escape(name)}</span><span class="category-count">${count}</span></button>`;
    }).join('');
  }
  function render() {
    const tokens = normalize(search.value).split(' ').filter(Boolean);
    const visible = items.filter(item => (category === 'All materials' || item.category === category) && tokens.every(token => searchable.get(item.id).includes(token)));
    if (sort.value === 'name') visible.sort((a,b) => a.name.localeCompare(b.name));
    if (sort.value === 'quantity') visible.sort((a,b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
    results.textContent = `Showing ${visible.length} of ${items.length} materials${category !== 'All materials' ? ` · ${category}` : ''}`;
    reset.hidden = !tokens.length && category === 'All materials' && sort.value === 'recommended';
    clearSearch.hidden = !search.value;
    empty.hidden = visible.length !== 0;
    grid.innerHTML = visible.map(item => `<article class="product-card">
      <button class="photo-button" type="button" data-item="${escape(item.id)}" aria-label="View ${escape(item.name)} details"><span class="photo-category">${escape(item.category)}</span>${image(item)}</button>
      <div class="product-info"><p class="product-model">${escape(item.model)}</p><h3><button type="button" data-item="${escape(item.id)}">${escape(item.name)}</button></h3><p class="product-description">${escape(item.description)}</p><span class="product-interface">${escape(item.interface.split(' / ')[0])}</span></div>
      <div class="card-bottom"><div><span class="initial-label">INITIAL QUANTITY</span><span class="quantity-value">${item.quantity}<span class="quantity-unit">${escape(unitFor(item))}</span></span>${item.pack_contents ? `<span class="pack-contents">${escape(item.pack_contents)}</span>` : ''}</div><button class="details-button" type="button" data-item="${escape(item.id)}" aria-label="View ${escape(item.name)} details">Details ${icon('arrow-right')}</button></div>
    </article>`).join('');
    installImageFallbacks(grid);
    for (const button of filters.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.category === category));
    updateUrl();
  }
  function showItem(id, opener) {
    const item = byId.get(id);
    if (!item) return;
    currentItem = id;
    lastOpener = opener || null;
    const productUrl = safeUrl(item.product_url), guideUrl = safeUrl(item.guide_url), sourceUrl = safeUrl(item.image_source_url);
    let supplier = 'supplier';
    if (sourceUrl) supplier = new URL(item.image_source_url).hostname.replace(/^www\./, '');
    detail.innerHTML = `<div class="detail-layout"><div class="detail-image-area">${image(item)}${sourceUrl ? `<a class="photo-credit" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Photo: ${escape(supplier)}</a>` : ''}</div><div class="detail-body"><p class="eyebrow">${escape(item.category)}</p><h2 id="detail-title">${escape(item.name)}</h2><p class="detail-model">${escape(item.model)}</p><p class="detail-description">${escape(item.description)}</p><dl class="detail-specs"><div><dt>Initial quantity</dt><dd>${escape(quantity(item))}${item.pack_contents ? `<br>${escape(item.pack_contents)}` : ''}</dd></div><div><dt>Interface</dt><dd>${escape(item.interface)}</dd></div><div><dt>Power</dt><dd>${escape(item.power)}</dd></div></dl>${item.notes ? `<div class="detail-notes"><h3>Getting started</h3><p>${escape(item.notes)}</p></div>` : ''}<div class="detail-links">${guideUrl ? `<a class="primary" href="${guideUrl}" target="_blank" rel="noopener noreferrer">Guide / documentation ${icon('arrow-up-right')}</a>` : ''}${productUrl ? `<a href="${productUrl}" target="_blank" rel="noopener noreferrer">Product reference ${icon('arrow-up-right')}</a>` : ''}</div><p class="detail-request">To request materials, fill out the Google Sheet provided in Sprint4.</p></div></div>`;
    installImageFallbacks(detail);
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('dialog-open');
    const url = new URL(location.href);
    url.hash = `item=${encodeURIComponent(id)}`;
    history.replaceState(null, '', url);
  }
  function resetAll() {
    search.value = '';
    category = 'All materials';
    sort.value = 'recommended';
    render();
  }
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    render();
  });
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-item]');
    if (button) showItem(button.dataset.item, button);
  });
  search.addEventListener('input', render);
  sort.addEventListener('change', render);
  clearSearch.addEventListener('click', () => {search.value = ''; render(); search.focus();});
  reset.addEventListener('click', resetAll);
  document.querySelector('#empty-reset').addEventListener('click', resetAll);
  document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    const url = new URL(location.href);
    if (url.hash.startsWith('#item=')) {url.hash = ''; history.replaceState(null, '', url);}
    currentItem = null;
    if (lastOpener?.isConnected) lastOpener.focus();
  });
  function readHash() {
    if (location.hash.startsWith('#item=')) {
      const id = new URLSearchParams(location.hash.slice(1)).get('item');
      if (id !== currentItem) showItem(id);
    } else if (dialog.open) dialog.close();
  }
  window.addEventListener('hashchange', readHash);
  const params = new URLSearchParams(location.search);
  search.value = params.get('q') || '';
  if (categories.includes(params.get('category'))) category = params.get('category');
  if (['recommended','name','quantity'].includes(params.get('sort'))) sort.value = params.get('sort');
  document.querySelector('#total-count').textContent = items.length;
  for (const [selector,id] of [['#hero-board','arduino'],['#hero-sensor','imu']]) {
    const heroImg = document.querySelector(selector);
    const item = byId.get(id);
    if(item && safeUrl(item.image_url)) heroImg.src = item.image_url;
    else heroImg.closest('.hero-product').hidden = true;
    heroImg.addEventListener('error', () => {heroImg.closest('.hero-product').hidden = true;}, {once:true});
  }
  renderCategories();
  render();
  readHash();
})();
