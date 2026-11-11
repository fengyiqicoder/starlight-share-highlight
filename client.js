// Browser side of starlight-share-highlight.

const STRINGS = {
	en: { link: 'Copy link', quote: 'Copy quote', x: 'Post', ask: 'Ask AI', copied: 'Copied', reading: 'Reading the page…', close: 'Close', aiFoot: 'Explained by AI from this page.' },
	zh: { link: '复制链接', quote: '复制引用', x: '分享', ask: '问 AI', copied: '已复制', reading: '正在读这一页…', close: '关闭', aiFoot: '由 AI 根据本页解释。' },
	ja: { link: 'リンクをコピー', quote: '引用をコピー', x: 'ポスト', ask: 'AI に聞く', copied: 'コピーしました', reading: 'ページを読んでいます…', close: '閉じる', aiFoot: 'このページをもとに AI が説明しました。' },
	es: { link: 'Copiar enlace', quote: 'Copiar cita', x: 'Publicar', ask: 'Preguntar a la IA', copied: 'Copiado', reading: 'Leyendo la página…', close: 'Cerrar', aiFoot: 'Explicado por IA a partir de esta página.' },
	fr: { link: 'Copier le lien', quote: 'Copier la citation', x: 'Publier', ask: 'Demander à l’IA', copied: 'Copié', reading: 'Lecture de la page…', close: 'Fermer', aiFoot: 'Expliqué par l’IA à partir de cette page.' },
	de: { link: 'Link kopieren', quote: 'Zitat kopieren', x: 'Posten', ask: 'KI fragen', copied: 'Kopiert', reading: 'Lese die Seite…', close: 'Schließen', aiFoot: 'KI-Erklärung auf Basis dieser Seite.' },
	pt: { link: 'Copiar link', quote: 'Copiar citação', x: 'Publicar', ask: 'Perguntar à IA', copied: 'Copiado', reading: 'Lendo a página…', close: 'Fechar', aiFoot: 'Explicado pela IA a partir desta página.' },
	ko: { link: '링크 복사', quote: '인용 복사', x: '게시', ask: 'AI에게 묻기', copied: '복사됨', reading: '페이지를 읽는 중…', close: '닫기', aiFoot: '이 페이지를 바탕으로 AI가 설명했습니다.' },
};

function el(tag, attrs = {}, ...children) {
	const n = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (v === false || v == null) continue;
		if (k === 'class') n.className = v;
		else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
		else n.setAttribute(k, v === true ? '' : v);
	}
	n.append(...children.filter((c) => c != null));
	return n;
}

// A text fragment URL (#:~:text=...) that scrolls to and highlights the selection in
// Chrome, Edge, Safari and Firefox. Long selections use textStart,textEnd.
const enc = (s) => encodeURIComponent(s).replace(/-/g, '%2D').replace(/,/g, '%2C').replace(/&/g, '%26');
export function fragmentUrl(text, href = location.href) {
	const clean = text.replace(/\s+/g, ' ').trim();
	const words = clean.split(' ');
	const frag = clean.length <= 80 || words.length <= 10 ? enc(clean) : enc(words.slice(0, 5).join(' ')) + ',' + enc(words.slice(-5).join(' '));
	return href.split('#')[0] + '#:~:text=' + frag;
}

async function copy(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const ta = el('textarea', { style: 'position:fixed;opacity:0' });
		ta.value = text;
		document.body.append(ta);
		ta.select();
		const ok = document.execCommand('copy');
		ta.remove();
		return ok;
	}
}

export default function init(cfg) {
	const root = document.querySelector('.sl-markdown-content');
	if (!root) return;
	const lang = (document.documentElement.lang || 'en').toLowerCase();
	const t = { ...STRINGS.en, ...(STRINGS[lang.split('-')[0]] || {}), ...cfg.labels };
	addStyle();

	let picked = null;
	const title = document.querySelector('h1#_top')?.textContent?.trim() || document.title;
	const buttons = [];
	const say = el('span', { class: 'ssh-said', 'aria-live': 'polite' });
	const done = (b) => {
		say.textContent = t.copied;
		setTimeout(() => (say.textContent = ''), 1500);
	};
	if (cfg.actions.includes('link')) buttons.push(el('button', { type: 'button', onclick: async () => (await copy(fragmentUrl(picked.text))) && done() }, t.link));
	if (cfg.actions.includes('quote'))
		buttons.push(el('button', { type: 'button', onclick: async () => (await copy(`> ${picked.text.replace(/\n+/g, '\n> ')}\n\n[${title}](${fragmentUrl(picked.text)})`)) && done() }, t.quote));
	if (cfg.actions.includes('x'))
		buttons.push(el('button', { type: 'button', onclick: () => window.open('https://x.com/intent/post?text=' + encodeURIComponent('“' + picked.text.slice(0, 200) + '”') + '&url=' + encodeURIComponent(fragmentUrl(picked.text)), '_blank', 'noopener') }, t.x));
	if (cfg.ai) buttons.push(el('button', { type: 'button', class: 'ssh-ai', onclick: () => askAi() }, t.ask));
	const bar = el('div', { class: 'ssh-bar', hidden: true, role: 'toolbar', 'aria-label': 'Selection', 'data-onetag-ui': '', onmousedown: (e) => e.preventDefault() }, ...buttons, say);
	const answer = el('div', { class: 'ssh-answer' });
	const card = el('div', { class: 'ssh-card', hidden: true, role: 'dialog', 'aria-label': t.ask, 'data-onetag-ui': '' }, answer, el('p', { class: 'ssh-foot' }, t.aiFoot + ' ', el('button', { type: 'button', class: 'ssh-close', onclick: () => (card.hidden = true) }, t.close)));
	document.body.append(bar, card);

	function selection() {
		const sel = getSelection();
		if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
		const text = sel.toString().trim();
		if (text.length < cfg.minChars || text.length > cfg.maxChars) return null;
		const range = sel.getRangeAt(0);
		const node = range.commonAncestorContainer;
		const elm = node.nodeType === 1 ? node : node.parentElement;
		if (!root.contains(elm) || elm.closest('[data-onetag-ui], input, textarea')) return null;
		const rects = range.getClientRects();
		const rect = rects[rects.length - 1] || range.getBoundingClientRect();
		const block = elm.closest('p, li, td, blockquote, dd, h2, h3, h4') || elm;
		return { text, rect, context: block.textContent.trim().slice(0, 1200) };
	}
	function place(node, rect, gap) {
		const left = Math.min(Math.max(8, rect.left + scrollX), scrollX + document.documentElement.clientWidth - node.offsetWidth - 8);
		node.style.left = left + 'px';
		node.style.top = rect.bottom + scrollY + gap + 'px';
	}
	let timer = 0;
	document.addEventListener('selectionchange', () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			const s = selection();
			if (!s) return (bar.hidden = true);
			picked = s;
			bar.hidden = false;
			place(bar, s.rect, 6);
		}, 250);
	});
	document.addEventListener('keydown', (e) => e.key === 'Escape' && ((bar.hidden = true), (card.hidden = true)));
	document.addEventListener('mousedown', (e) => !card.hidden && !card.contains(e.target) && (card.hidden = true));

	async function askAi() {
		if (!picked) return;
		bar.hidden = true;
		card.hidden = false;
		place(card, picked.rect, 8);
		answer.textContent = t.reading;
		try {
			const api = await import('starlight-onetag/api');
			const out = el('div');
			answer.replaceChildren(out);
			await api.explainText(cfg.ai, picked.text, out, { context: picked.context });
		} catch (e) {
			const api = await import('starlight-onetag/api').catch(() => null);
			answer.textContent = api ? api.errorText(e) : 'Could not load the AI helper.';
		}
	}
}

function addStyle() {
	if (document.getElementById('starlight-share-highlight')) return;
	const s = document.createElement('style');
	s.id = 'starlight-share-highlight';
	s.textContent = `
.ssh-bar { position: absolute; z-index: 30; display: flex; align-items: center; gap: 2px; padding: 3px; border: 1px solid var(--sl-color-gray-5); border-radius: .5rem; background: var(--sl-color-gray-6); box-shadow: var(--sl-shadow-md); font-size: var(--sl-text-sm); }
.ssh-bar[hidden], .ssh-card[hidden] { display: none; }
.ssh-bar button { font: inherit; padding: .25rem .6rem; border: 0; border-radius: .35rem; background: transparent; color: var(--sl-color-text); cursor: pointer; white-space: nowrap; }
.ssh-bar button:hover, .ssh-bar button:focus-visible { background: var(--sl-color-accent-low); color: var(--sl-color-white); outline: none; }
.ssh-bar .ssh-ai { color: var(--sl-color-text-accent); }
.ssh-said { padding-inline: .4rem; color: var(--sl-color-gray-3); font-size: var(--sl-text-xs); }
.ssh-said:empty { display: none; }
.ssh-card { position: absolute; z-index: 31; width: min(26rem, calc(100vw - 1rem)); padding: .85rem 1rem; border: 1px solid var(--sl-color-gray-5); border-radius: .5rem; background: var(--sl-color-gray-6); color: var(--sl-color-text); box-shadow: var(--sl-shadow-lg); font-size: var(--sl-text-sm); }
.ssh-card p { margin: 0 0 .5em; }
.ssh-foot { color: var(--sl-color-gray-3); font-size: var(--sl-text-xs); margin: .25rem 0 0; }
.ssh-close { border: 0; background: none; padding: 0; font: inherit; color: var(--sl-color-text-accent); text-decoration: underline; cursor: pointer; }
`;
	document.head.append(s);
}
