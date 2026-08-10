const header = document.querySelector('[data-header]');
const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

function updateHeader() {
  header?.classList.toggle('is-scrolled', window.scrollY > 12);
}

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

navToggle?.addEventListener('click', () => {
  const open = navToggle.getAttribute('aria-expanded') !== 'true';
  navToggle.setAttribute('aria-expanded', String(open));
  nav?.classList.toggle('is-open', open);
  document.body.classList.toggle('nav-open', open);
});

nav?.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) return;
  navToggle?.setAttribute('aria-expanded', 'false');
  nav.classList.remove('is-open');
  document.body.classList.remove('nav-open');
});

const tabs = [...document.querySelectorAll('[data-tab]')];
const panels = [...document.querySelectorAll('[data-panel]')];

function selectTab(selectedTab) {
  const target = selectedTab.dataset.tab;
  for (const tab of tabs) {
    tab.setAttribute('aria-selected', String(tab === selectedTab));
    tab.tabIndex = tab === selectedTab ? 0 : -1;
  }
  for (const panel of panels) {
    const active = panel.dataset.panel === target;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  }
}

for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const currentIndex = tabs.indexOf(tab);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
    nextTab?.focus();
    if (nextTab) selectTab(nextTab);
  });
}

async function copyText(button, text) {
  const label = button.querySelector('[data-copy-label]');
  const original = label?.textContent ?? 'Copy';
  try {
    await navigator.clipboard.writeText(text);
    if (label) label.textContent = 'Copied';
  } catch {
    if (label) label.textContent = 'Select text';
  }
  window.setTimeout(() => {
    if (label) label.textContent = original;
  }, 1600);
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', () => copyText(button, button.dataset.copy ?? ''));
}

for (const button of document.querySelectorAll('[data-copy-panel]')) {
  button.addEventListener('click', () => {
    const scope = button.closest('.code-window, .example-code-wrap');
    const code = scope?.querySelector('pre:not([hidden]) code, pre code');
    if (code) copyText(button, code.textContent ?? '');
  });
}

const filters = [...document.querySelectorAll('[data-filter]')];
const exampleCards = [...document.querySelectorAll('[data-example-category]')];
const visibleCount = document.querySelector('[data-visible-count]');

function filterExamples(button) {
  const filter = button.dataset.filter ?? 'all';
  let count = 0;

  for (const filterButton of filters) {
    filterButton.setAttribute('aria-pressed', String(filterButton === button));
  }
  for (const card of exampleCards) {
    const categories = (card.dataset.exampleCategory ?? '').split(' ');
    const visible = filter === 'all' || categories.includes(filter);
    card.hidden = !visible;
    if (visible) count += 1;
  }
  if (visibleCount) visibleCount.textContent = String(count);
}

for (const filter of filters) {
  filter.addEventListener('click', () => filterExamples(filter));
}

const apiSearch = document.querySelector('[data-api-search]');
const apiSymbols = [...document.querySelectorAll('[data-api-symbol]')];
const apiGroups = [...document.querySelectorAll('[data-api-group]')];
const apiResultCount = document.querySelector('[data-api-result-count]');
const apiEmpty = document.querySelector('[data-api-empty]');

function filterApiSymbols() {
  if (!(apiSearch instanceof HTMLInputElement)) return;
  const query = apiSearch.value.trim().toLowerCase();
  let visibleTotal = 0;

  for (const symbol of apiSymbols) {
    const searchText = symbol.getAttribute('data-api-search-text') ?? '';
    const visible = query.length === 0 || searchText.includes(query);
    symbol.hidden = !visible;
    if (visible) visibleTotal += 1;
  }

  for (const group of apiGroups) {
    const visibleSymbols = [...group.querySelectorAll('[data-api-symbol]')].filter(
      (symbol) => !symbol.hidden
    );
    group.hidden = visibleSymbols.length === 0;
    const count = group.querySelector('[data-api-group-count]');
    if (count) count.textContent = String(visibleSymbols.length);
  }

  if (apiResultCount) apiResultCount.textContent = String(visibleTotal);
  if (apiEmpty) apiEmpty.hidden = visibleTotal !== 0;
}

apiSearch?.addEventListener('input', filterApiSymbols);

document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    return;
  if (!(apiSearch instanceof HTMLInputElement)) return;
  event.preventDefault();
  apiSearch.focus();
});

function revealApiHash() {
  const id = window.location.hash.slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  const symbol = target?.closest('[data-api-symbol]');
  const group = target?.closest('[data-api-group]');
  if ((symbol?.hidden || group?.hidden) && apiSearch instanceof HTMLInputElement) {
    apiSearch.value = '';
    filterApiSymbols();
  }
  target?.closest('details')?.setAttribute('open', '');
}

revealApiHash();
window.addEventListener('hashchange', revealApiHash);
