import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Application, ReflectionKind, TSConfigReader, TypeDocReader } from 'typedoc';

const API_GROUPS = [
  { kind: ReflectionKind.Class, label: 'Classes' },
  { kind: ReflectionKind.Interface, label: 'Interfaces' },
  { kind: ReflectionKind.TypeAlias, label: 'Type aliases' },
  { kind: ReflectionKind.Function, label: 'Functions' },
  { kind: ReflectionKind.Variable, label: 'Exports' }
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function displayPartsText(parts = []) {
  return parts.map((part) => part.text ?? '').join('');
}

function formatInline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\s*\n\s*/g, ' ');
}

function commentFor(reflection) {
  return (
    reflection.comment ?? reflection.signatures?.find((signature) => signature.comment)?.comment
  );
}

function renderComment(reflection) {
  const comment = commentFor(reflection);
  if (!comment) return '';

  const summary = displayPartsText(comment.summary).trim();
  const summaryHtml = summary ? `<p class="api-description">${formatInline(summary)}</p>` : '';
  const blockHtml = (comment.blockTags ?? [])
    .map((tag) => {
      const content = displayPartsText(tag.content).trim();
      if (!content) return '';

      const codeFence = content.match(/^```(?:\w+)?\n([\s\S]*?)\n```$/);
      if (codeFence) {
        return `<div class="api-example"><span>${escapeHtml(tag.tag.slice(1))}</span><pre><code>${escapeHtml(codeFence[1])}</code></pre></div>`;
      }

      return `<div class="api-note"><strong>${escapeHtml(tag.tag.slice(1))}</strong><p>${formatInline(content)}</p></div>`;
    })
    .join('');

  return summaryHtml + blockHtml;
}

function renderTypeParameters(parameters = []) {
  if (parameters.length === 0) return '';
  const rendered = parameters.map((parameter) => {
    const constraint = parameter.type ? ` extends ${parameter.type}` : '';
    const defaultType = parameter.default ? ` = ${parameter.default}` : '';
    return `${parameter.name}${constraint}${defaultType}`;
  });
  return `<${rendered.join(', ')}>`;
}

function renderParameters(parameters = []) {
  return parameters
    .map((parameter) => {
      const rest = parameter.flags.isRest ? '...' : '';
      const optional =
        parameter.flags.isOptional || parameter.defaultValue !== undefined ? '?' : '';
      const type = parameter.type?.toString() ?? 'unknown';
      return `${rest}${parameter.name}${optional}: ${type}`;
    })
    .join(', ');
}

function signatureText(reflection, parentName) {
  if (reflection.kind === ReflectionKind.Class) {
    return `export class ${reflection.name}${renderTypeParameters(reflection.typeParameters)}`;
  }
  if (reflection.kind === ReflectionKind.Interface) {
    return `export interface ${reflection.name}${renderTypeParameters(reflection.typeParameters)}`;
  }
  if (reflection.kind === ReflectionKind.TypeAlias) {
    return `export type ${reflection.name}${renderTypeParameters(reflection.typeParameters)} = ${reflection.type?.toString() ?? 'unknown'}`;
  }
  if (reflection.kind === ReflectionKind.Variable) {
    return `export const ${reflection.name}: ${reflection.type?.toString() ?? 'unknown'}`;
  }

  if (
    reflection.kind === ReflectionKind.CallSignature ||
    reflection.kind === ReflectionKind.ConstructorSignature
  ) {
    const typeParameters = renderTypeParameters(reflection.typeParameters);
    const parameters = renderParameters(reflection.parameters);
    const returnType = reflection.type?.toString() ?? parentName ?? 'unknown';
    return `${reflection.name}${typeParameters}(${parameters}): ${returnType}`;
  }

  const signatures = reflection.signatures ?? [];
  if (signatures.length > 0) {
    return signatures
      .map((signature) => {
        const name =
          reflection.kind === ReflectionKind.Constructor ? 'constructor' : reflection.name;
        const typeParameters = renderTypeParameters(signature.typeParameters);
        const parameters = renderParameters(signature.parameters);
        const returnType =
          reflection.kind === ReflectionKind.Constructor
            ? parentName
            : (signature.type?.toString() ?? 'unknown');
        return `${name}${typeParameters}(${parameters}): ${returnType}`;
      })
      .join('\n');
  }

  const optional = reflection.flags.isOptional ? '?' : '';
  return `${reflection.name}${optional}: ${reflection.type?.toString() ?? 'unknown'}`;
}

function sourceLink(reflection) {
  const source = reflection.sources?.find((item) => item.url);
  if (!source?.url) return '';
  return `<a class="api-source" href="${escapeHtml(source.url)}">${escapeHtml(source.fileName)}:${source.line} ↗</a>`;
}

function kindLabel(kind) {
  if (kind === ReflectionKind.Class) return 'Class';
  if (kind === ReflectionKind.Interface) return 'Interface';
  if (kind === ReflectionKind.TypeAlias) return 'Type alias';
  if (kind === ReflectionKind.Function) return 'Function';
  if (kind === ReflectionKind.Constructor) return 'Constructor';
  if (kind === ReflectionKind.Method) return 'Method';
  if (kind === ReflectionKind.Property) return 'Property';
  if (kind === ReflectionKind.Variable) return 'Export';
  if (kind === ReflectionKind.Accessor) return 'Accessor';
  if (kind === ReflectionKind.CallSignature) return 'Call signature';
  if (kind === ReflectionKind.ConstructorSignature) return 'Constructor signature';
  return 'Member';
}

function renderMembers(reflection, symbolId) {
  const children = reflection.children ?? [];
  const signatures = reflection.signatures ?? [];
  const members =
    reflection.kind === ReflectionKind.Class || reflection.kind === ReflectionKind.Interface
      ? [...signatures, ...children]
      : children;
  if (members.length === 0) return '';

  const ids = new Map();
  const rows = members
    .map((member) => {
      const baseId = `${symbolId}-${slugify(member.name) || 'call'}`;
      const duplicateCount = (ids.get(baseId) ?? 0) + 1;
      ids.set(baseId, duplicateCount);
      const memberId = duplicateCount === 1 ? baseId : `${baseId}-${duplicateCount}`;
      const inherited = member.inheritedFrom ? '<span class="api-inherited">inherited</span>' : '';

      return `<li class="api-member" id="${memberId}">
        <div class="api-member-heading">
          <span class="api-member-kind">${kindLabel(member.kind)}</span>
          ${sourceLink(member)}
        </div>
        <code class="api-member-signature">${escapeHtml(signatureText(member, reflection.name))}</code>
        ${inherited}
        ${renderComment(member)}
      </li>`;
    })
    .join('');

  return `<details class="api-members">
    <summary><span>Members</span><b>${members.length}</b></summary>
    <ul>${rows}</ul>
  </details>`;
}

function renderSymbol(reflection) {
  const symbolId = `api-${slugify(reflection.name)}`;
  const searchText = [
    reflection.name,
    kindLabel(reflection.kind),
    displayPartsText(commentFor(reflection)?.summary),
    ...(reflection.children ?? []).map((child) => child.name)
  ]
    .join(' ')
    .toLowerCase();

  return `<article class="api-symbol" id="${symbolId}" data-api-symbol data-api-search-text="${escapeHtml(searchText)}">
    <div class="api-symbol-heading">
      <div>
        <span class="api-kind">${kindLabel(reflection.kind)}</span>
        <h2>${escapeHtml(reflection.name)}</h2>
      </div>
      ${sourceLink(reflection)}
    </div>
    <pre class="api-signature"><code>${escapeHtml(signatureText(reflection))}</code></pre>
    ${renderComment(reflection)}
    ${renderMembers(reflection, symbolId)}
  </article>`;
}

function renderGroup(group, reflections) {
  const items = reflections.filter((reflection) => reflection.kind === group.kind);
  if (items.length === 0) return '';

  return `<section class="api-group" id="api-${slugify(group.label)}" data-api-group>
    <div class="api-group-heading">
      <span>${escapeHtml(group.label)}</span>
      <strong data-api-group-count>${items.length}</strong>
    </div>
    <div class="api-symbol-list">${items.map(renderSymbol).join('')}</div>
  </section>`;
}

function renderNavigation(groups, reflections) {
  return groups
    .map((group) => {
      const items = reflections.filter((reflection) => reflection.kind === group.kind);
      if (items.length === 0) return '';
      return `<div class="api-nav-group">
        <a class="api-nav-heading" href="#api-${slugify(group.label)}">${escapeHtml(group.label)} <span>${items.length}</span></a>
        ${items.map((item) => `<a href="#api-${slugify(item.name)}">${escapeHtml(item.name)}</a>`).join('')}
      </div>`;
    })
    .join('');
}

function renderQuickNavigation(groups, reflections) {
  return groups
    .map((group) => {
      const count = reflections.filter((reflection) => reflection.kind === group.kind).length;
      if (count === 0) return '';
      return `<a href="#api-${slugify(group.label)}"><span>${escapeHtml(group.label)}</span><small>${count}</small></a>`;
    })
    .join('');
}

function renderPage(project) {
  const reflections = project.children ?? [];
  const groups = API_GROUPS.filter((group) =>
    reflections.some((reflection) => reflection.kind === group.kind)
  );
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="The Beelzebub 2.0 API reference, generated from the exported TypeScript declarations and code comments." />
    <meta name="theme-color" content="#140d20" />
    <title>API reference — Beelzebub 2.0</title>
    <link rel="icon" href="/assets/bz-logo.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/assets/site.css" />
    <script src="/assets/site.js" defer></script>
    <script src="/assets/page-trace.js" defer></script>
  </head>
  <body class="api-page">
    <a class="skip-link" href="#main">Skip to content</a>

    <header class="site-header" data-header>
      <div class="shell nav-shell">
        <a class="brand" href="/" aria-label="Beelzebub home">
          <span class="brand-mark"><img src="/assets/bz-logo.svg" alt="" /></span>
          <span class="brand-name">beelzebub</span>
          <span class="version-pill">2.0</span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" data-nav-toggle>
          <span class="nav-toggle-line"></span><span class="nav-toggle-line"></span>
          <span class="sr-only">Toggle navigation</span>
        </button>
        <nav class="primary-nav" id="primary-nav" aria-label="Primary" data-nav>
          <a href="/">Overview</a>
          <a href="/examples/">Examples</a>
          <a href="/api/" aria-current="page">API</a>
          <a href="/migrate/">Migrate</a>
          <a class="nav-github" href="https://github.com/jstty/beelzebub">GitHub</a>
        </nav>
      </div>
    </header>

    <main id="main">
      <section class="api-hero" aria-labelledby="api-hero-title">
        <div class="shell api-hero-inner">
          <div class="api-hero-heading">
            <div>
              <span class="eyebrow eyebrow-bright">API REFERENCE</span>
              <h1 id="api-hero-title">Find the API you need.</h1>
            </div>
            <p><strong data-api-result-count>${reflections.length}</strong> exported symbols, generated directly from Beelzebub's TypeScript and TSDoc.</p>
          </div>
          <label class="api-search api-hero-search">
            <span>Search the reference</span>
            <input type="search" placeholder="Try run, BzTasks, VarDef…" autocomplete="off" data-api-search />
            <kbd>/</kbd>
          </label>
          <nav class="api-quick-nav" aria-label="Jump to API sections">
            <span>Jump to</span>
            ${renderQuickNavigation(groups, reflections)}
          </nav>
        </div>
      </section>

      <section class="api-content">
        <div class="shell api-layout">
          <aside class="api-sidebar">
            <strong class="api-sidebar-label">Browse symbols</strong>
            <nav class="api-nav" aria-label="API symbols">${renderNavigation(groups, reflections)}</nav>
            <p class="api-generated-note"><span></span> Generated from exported TypeScript and TSDoc.</p>
          </aside>

          <div class="api-reference">
            <section class="api-start" aria-labelledby="api-start-title">
              <div>
                <span class="eyebrow">START HERE</span>
                <h2 id="api-start-title">The default export is your task engine.</h2>
                <p>Extend <code>BzTasks</code>, register the class, and run a fully-qualified task name. The same APIs work from ESM and CommonJS.</p>
                <a class="text-link" href="/examples/">See working examples →</a>
              </div>
              <pre><code>import bz, { BzTasks } from 'beelzebub';

class Build extends BzTasks {
  compile() { /* your work */ }
}

bz.add(Build);
await bz.run('Build.compile');</code></pre>
            </section>

            <div class="api-empty" data-api-empty hidden>
              <strong>No matching symbols.</strong>
              <span>Try a class, method, interface, or type name.</span>
            </div>
            ${groups.map((group) => renderGroup(group, reflections)).join('')}
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="shell footer-grid">
        <div class="footer-brand">
          <a class="brand" href="/"><span class="brand-mark"><img src="/assets/bz-logo.svg" alt="" /></span><span class="brand-name">beelzebub</span></a>
          <p>Modular, observable task orchestration for modern Node.js.</p>
          <span class="footer-license">MIT licensed · Built with fire resistance</span>
        </div>
        <div class="footer-column"><strong>Learn</strong><a href="/examples/">Examples</a><a href="/api/">API reference</a><a href="/migrate/">Migrate</a></div>
        <div class="footer-column"><strong>Project</strong><a href="https://github.com/jstty/beelzebub">GitHub</a><a href="https://www.npmjs.com/package/beelzebub">npm</a><a href="https://github.com/jstty/beelzebub/issues">Issues</a></div>
        <div class="footer-column"><strong>Version</strong><span>2.0.0</span><span>Node 24+</span><span>ESM + CommonJS</span></div>
      </div>
    </footer>
  </body>
</html>`;
}

export async function buildApiReference(projectRoot, outputRoot) {
  const application = await Application.bootstrap(
    { options: path.join(projectRoot, 'typedoc.json') },
    [new TypeDocReader(), new TSConfigReader()]
  );
  const project = await application.convert();
  if (!project) throw new Error('TypeDoc could not build the API model');

  const apiOutputRoot = path.join(outputRoot, 'api');
  mkdirSync(apiOutputRoot, { recursive: true });
  writeFileSync(path.join(apiOutputRoot, 'index.html'), renderPage(project));
}
