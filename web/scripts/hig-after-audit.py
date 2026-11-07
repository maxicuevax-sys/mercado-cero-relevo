"""
Auditoría HIG de la implementación F3 (Mostrador claro).

Uso:
  python scripts/hig-after-audit.py

Requiere el servidor en http://localhost:3001 y axe.min.js en la ruta indicada.
No modifica la UI. Guarda capturas y JSON en mercado-cero/demo/hig-after/.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get("HIG_BASE_URL", os.environ.get("BASE_URL", "http://localhost:3000")).rstrip("/")
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get("HIG_OUT", ROOT / "demo" / "hig-after"))
OUT.mkdir(parents=True, exist_ok=True)
AXE = Path(r"C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\axe.min.js")
VIEWPORTS = [(320, 640), (360, 800), (390, 844), (768, 1024), (1280, 800)]
if os.environ.get("VIEWPORTS"):
    VIEWPORTS = [
        tuple(int(value) for value in pair.lower().split("x"))
        for pair in os.environ["VIEWPORTS"].split(",")
    ]
results: list[dict] = []


def git_value(*args: str) -> str:
    try:
        return subprocess.check_output(
            ["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return ""


def code_info() -> dict:
    return {
        "commit": git_value("rev-parse", "HEAD"),
        # Incluye untracked bajo web/ para no declarar limpio un árbol con código nuevo.
        "dirty": bool(git_value("status", "--porcelain", "--", "web")),
    }


def shot(page, name: str, full: bool = False) -> None:
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)


def wait_text(page, text: str, timeout: int = 15000) -> bool:
    try:
        page.wait_for_selector(f"text={text}", timeout=timeout)
        return True
    except Exception:
        return False


def run_axe(page) -> dict:
    if page.evaluate("typeof axe === 'undefined'"):
        page.add_script_tag(path=str(AXE))
    return page.evaluate(
        """async () => {
            const r = await axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }
            });
            return {
                violations: r.violations.map(v => ({
                    id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
                    targets: v.nodes.slice(0, 4).map(n => n.target)
                })),
                passes: r.passes.length
            };
        }"""
    )


def measure(page, label: str) -> dict:
    data = page.evaluate(
        """() => {
            const dialog = document.querySelector('[role="dialog"]');
            const root = dialog || document;
            const clippedByAncestor = (el) => {
                const r = el.getBoundingClientRect();
                let node = el.parentElement;
                while (node && node !== document.body) {
                    const s = getComputedStyle(node);
                    if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) {
                        const a = node.getBoundingClientRect();
                        if (r.bottom <= a.top + 1 || r.top >= a.bottom - 1 || r.right <= a.left + 1 || r.left >= a.right - 1) return true;
                    }
                    node = node.parentElement;
                }
                return false;
            };
            const visible = (el) => {
                const r = el.getBoundingClientRect();
                const s = getComputedStyle(el);
                return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0' && !clippedByAncestor(el);
            };
            const parseColor = (value) => {
                const match = String(value || '').match(/rgba?\\(([^)]+)\\)/);
                if (!match) return null;
                const parts = match[1].split(',').map(part => parseFloat(part.trim()));
                if (parts.length < 3 || parts.some((part, index) => index < 3 && !Number.isFinite(part))) return null;
                return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
            };
            const blend = (fg, bg) => ({
                r: fg.r * fg.a + bg.r * (1 - fg.a),
                g: fg.g * fg.a + bg.g * (1 - fg.a),
                b: fg.b * fg.a + bg.b * (1 - fg.a),
                a: 1,
            });
            const luminance = (color) => {
                const channel = (value) => {
                    const c = value / 255;
                    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
                };
                return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
            };
            const contrast = (a, b) => {
                const la = luminance(a), lb = luminance(b);
                return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
            };
            const solidBackground = (el) => {
                let node = el;
                while (node && node !== document.documentElement) {
                    const color = parseColor(getComputedStyle(node).backgroundColor);
                    if (color && color.a >= 0.95) return color;
                    node = node.parentElement;
                }
                const htmlColor = parseColor(getComputedStyle(document.documentElement).backgroundColor);
                if (htmlColor && htmlColor.a >= 0.95) return htmlColor;
                return parseColor(getComputedStyle(document.body).backgroundColor) || { r: 243, g: 236, b: 224, a: 1 };
            };
            const textEls = Array.from(root.querySelectorAll('p, span, button, a, label, h1, h2, h3, h4, dt, dd, li'))
                .filter(el => el.innerText && el.innerText.trim().length > 0 && visible(el))
                .map(el => ({
                    text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 80),
                    size: parseFloat(getComputedStyle(el).fontSize),
                    tag: el.tagName
                }));
            const targets = Array.from(root.querySelectorAll('button, a, input, select, textarea, [role="button"]'))
                .filter(visible)
                .map(el => {
                    const r = el.getBoundingClientRect();
                    return {
                        text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 50),
                        tag: el.tagName, width: Math.round(r.width), height: Math.round(r.height)
                    };
                });
            const unnamed = Array.from(root.querySelectorAll('button, a, [role="button"]'))
                .filter(visible)
                .filter(el => !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title'));

            // Clipping: text that is cut off by the viewport, by an
            // overflow-hidden ancestor, or by its own box (scrollWidth).
            const clipped = [];
            const addClip = (entry) => clipped.push(entry);
            for (const el of root.querySelectorAll('p, span, h1, h2, h3, h4, dt, dd, li, button, a, label')) {
                if (!visible(el) || !(el.innerText || '').trim()) continue;
                const r = el.getBoundingClientRect();
                if (r.right > window.innerWidth + 1 || r.left < -1 || r.width > window.innerWidth + 1) {
                    addClip({ reason: 'viewport', tag: el.tagName, text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 50), left: Math.round(r.left), right: Math.round(r.right), intentional: el.classList.contains('truncate') });
                    continue;
                }
                const s = getComputedStyle(el);
                const hiddenX = s.overflowX === 'hidden' || s.overflowX === 'clip';
                const hiddenY = s.overflowY === 'hidden' || s.overflowY === 'clip';
                if ((hiddenX && el.scrollWidth > el.clientWidth + 1) || (hiddenY && el.scrollHeight > el.clientHeight + 1)) {
                    addClip({ reason: hiddenX ? 'overflow-x' : 'overflow-y', tag: el.tagName, text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 50), scroll: el.scrollWidth + 'x' + el.scrollHeight, client: el.clientWidth + 'x' + el.clientHeight, cls: (el.className || '').toString().slice(0, 60), intentional: el.classList.contains('truncate') });
                    continue;
                }
                if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
                    addClip({ reason: 'text-overflow', tag: el.tagName, text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 50), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, cls: (el.className || '').toString().slice(0, 60), intentional: el.classList.contains('truncate') });
                    continue;
                }
                // Partial clipping by an overflow-hidden/clip ancestor. Content
                // inside a scrollable ancestor is reachable, and .truncate is
                // an intentional single-line ellipsis.
                let node = el.parentElement;
                let ancestorClip = null;
                let insideScroller = false;
                while (node && node !== document.body && !ancestorClip) {
                    const ns = getComputedStyle(node);
                    const scrolls = ns.overflowY === 'auto' || ns.overflowY === 'scroll' || ns.overflowX === 'auto' || ns.overflowX === 'scroll';
                    if (scrolls) insideScroller = true;
                    if ((ns.overflowX === 'hidden' || ns.overflowX === 'clip' || ns.overflowY === 'hidden' || ns.overflowY === 'clip')) {
                        const a = node.getBoundingClientRect();
                        if (!insideScroller && !node.classList.contains('truncate') && (r.right > a.right + 2 || r.left < a.left - 2 || r.bottom > a.bottom + 2 || r.top < a.top - 2)) {
                            ancestorClip = {
                                reason: 'ancestor-clip',
                                tag: el.tagName,
                                text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 50),
                                cls: (el.className || '').toString().slice(0, 60),
                                intentional: Boolean(el.closest('.truncate')),
                            };
                        }
                    }
                    node = node.parentElement;
                }
                if (ancestorClip) addClip(ancestorClip);

                const fontSize = parseFloat(s.fontSize);
                const lineHeight = parseFloat(s.lineHeight);
                if (fontSize >= 24 && Number.isFinite(lineHeight) && lineHeight / fontSize < 1) {
                    addClip({
                        reason: 'tight-line-height',
                        tag: el.tagName,
                        text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 50),
                        fontSize,
                        lineHeight,
                        intentional: false,
                    });
                }
            }

            // Fully clipped text: a visible element completely outside an
            // overflow-hidden/clip ancestor (not reachable by scrolling).
            for (const el of root.querySelectorAll('p, span, h1, h2, h3, h4, dt, dd, li, button, a, label')) {
                if (!(el.innerText || '').trim() || el.getClientRects().length === 0) continue;
                const s = getComputedStyle(el);
                if (s.display === 'none' || s.visibility === 'hidden') continue;
                const r = el.getBoundingClientRect();
                let node = el.parentElement;
                let insideScroller = false;
                let fully = null;
                while (node && node !== document.body && !fully) {
                    const ns = getComputedStyle(node);
                    if (ns.overflowY === 'auto' || ns.overflowY === 'scroll' || ns.overflowX === 'auto' || ns.overflowX === 'scroll') insideScroller = true;
                    if (!insideScroller && !node.classList.contains('truncate') && (ns.overflowX === 'hidden' || ns.overflowX === 'clip' || ns.overflowY === 'hidden' || ns.overflowY === 'clip')) {
                        const a = node.getBoundingClientRect();
                        if (r.bottom <= a.top + 1 || r.top >= a.bottom - 1 || r.right <= a.left + 1 || r.left >= a.right - 1) {
                            fully = {
                                reason: 'fully-clipped',
                                tag: el.tagName,
                                text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 50),
                                cls: (el.className || '').toString().slice(0, 60),
                                intentional: Boolean(el.closest('.truncate')),
                            };
                        }
                    }
                    node = node.parentElement;
                }
                if (fully) addClip(fully);
            }

            // Collapsed controls: a visible input/textarea with ~zero size is
            // unusable even if it technically has a client rect.
            for (const el of root.querySelectorAll('input, select, textarea')) {
                if (el.type === 'hidden' || el.type === 'radio' || el.type === 'checkbox') continue;
                if (el.classList.contains('sr-only')) continue;
                if (el.closest('[hidden]')) continue;
                if (el.getClientRects().length === 0) continue;
                const s = getComputedStyle(el);
                if (s.display === 'none' || s.visibility === 'hidden') continue;
                const r = el.getBoundingClientRect();
                if (r.width < 8 || r.height < 8) {
                    addClip({
                        reason: 'collapsed-control',
                        tag: el.tagName,
                        text: (el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').slice(0, 50),
                        width: Math.round(r.width),
                        height: Math.round(r.height),
                        intentional: false,
                    });
                }
            }

            // Overlap between interactive targets (excludes nested elements).
            const effectiveRect = (el) => {
                let r = el.getBoundingClientRect();
                let node = el.parentElement;
                while (node && node !== document.body) {
                    const s = getComputedStyle(node);
                    if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) {
                        const a = node.getBoundingClientRect();
                        const left = Math.max(r.left, a.left);
                        const right = Math.min(r.right, a.right);
                        const top = Math.max(r.top, a.top);
                        const bottom = Math.min(r.bottom, a.bottom);
                        if (right <= left || bottom <= top) return null;
                        r = { left, right, top, bottom, width: right - left, height: bottom - top };
                    }
                    node = node.parentElement;
                }
                return r;
            };
            const hasFloatingAncestor = (el) => {
                let node = el;
                while (node && node !== document.body) {
                    const position = getComputedStyle(node).position;
                    if (position === 'fixed' || position === 'sticky') return true;
                    node = node.parentElement;
                }
                return false;
            };
            const interactive = Array.from(root.querySelectorAll('button, a[href], input, select, textarea'))
                .filter(visible)
                .map(el => ({ el, r: el.getBoundingClientRect(), effective: effectiveRect(el), floating: hasFloatingAncestor(el) }))
                .filter(x => x.r.width > 0 && x.r.height > 0 && x.effective);
            const overlaps = [];
            const overlays = [];
            for (let i = 0; i < interactive.length; i++) {
                for (let j = i + 1; j < interactive.length; j++) {
                    const a = interactive[i], b = interactive[j];
                    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
                    const x = Math.max(0, Math.min(a.effective.right, b.effective.right) - Math.max(a.effective.left, b.effective.left));
                    const y = Math.max(0, Math.min(a.effective.bottom, b.effective.bottom) - Math.max(a.effective.top, b.effective.top));
                    const area = x * y;
                    const minArea = Math.min(a.effective.width * a.effective.height, b.effective.width * b.effective.height);
                    if (minArea > 0 && area / minArea > 0.25) {
                        const entry = {
                            a: (a.el.innerText || a.el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 35),
                            b: (b.el.innerText || b.el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 35),
                            ratio: Math.round((area / minArea) * 100)
                        };
                        // Fixed/sticky chrome (tab bar) intentionally floats over
                        // scrolling content; report it but don't fail the gate.
                        (a.floating || b.floating ? overlays : overlaps).push(entry);
                    }
                }
            }

            // Fragmentación: una palabra partida en dos líneas por break-word.
            const brokenWords = [];
            const seenBroken = new Set();
            const wordPattern = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/g;
            for (const el of root.querySelectorAll('h1, h2, h3, h4, p, span, button, a, label, li')) {
                if (!visible(el)) continue;
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                let node;
                while ((node = walker.nextNode())) {
                    const text = node.textContent || '';
                    if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/.test(text)) continue;
                    wordPattern.lastIndex = 0;
                    let match;
                    while ((match = wordPattern.exec(text))) {
                        const range = document.createRange();
                        range.setStart(node, match.index);
                        range.setEnd(node, match.index + match[0].length);
                        const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0);
                        const lines = new Set(rects.map(rect => Math.round(rect.top)));
                        if (lines.size > 1) {
                            const label = (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 48);
                            const key = `${match[0]}@${label}@${Math.min(...lines)}`;
                            if (!seenBroken.has(key)) {
                                seenBroken.add(key);
                                brokenWords.push({ word: match[0], text: label, lines: lines.size });
                            }
                        }
                    }
                }
            }

            const header = document.querySelector('header');
            const headerHeight = header ? header.getBoundingClientRect().height : 0;
            const sale = document.querySelector('#sale-text');
            const saleRect = sale ? sale.getBoundingClientRect() : null;
            const tabBar = document.querySelector('nav[aria-label="Navegación inferior"]');
            const tabBarStyle = tabBar ? getComputedStyle(tabBar) : null;
            const tabBarRect =
                tabBar && tabBarStyle && tabBarStyle.display !== 'none'
                    ? tabBar.getBoundingClientRect()
                    : null;
            const tabBarVisible = Boolean(
                tabBarRect && tabBarRect.height > 0 && tabBarRect.top < window.innerHeight
            );
            const saleAboveTabBar = saleRect && tabBarVisible
                ? saleRect.bottom <= tabBarRect.top + 1
                : null;
            const saleVisible = saleRect
                ? saleRect.top < window.innerHeight &&
                  saleRect.bottom > 0 &&
                  (!tabBarVisible || saleRect.bottom <= tabBarRect.top + 1)
                : null;
            const metaAction = Array.from(document.querySelectorAll('button')).find(
                el => (el.innerText || '').trim() === 'Apartar' && visible(el)
            );
            const metaActionRect = metaAction ? metaAction.getBoundingClientRect() : null;
            const metaAmount = Array.from(root.querySelectorAll('p, span')).find(
                el => /\\$[\\d.,]+\\s+de\\s+\\$[\\d.,]+/.test(el.innerText || '') && visible(el)
            );
            const optionGrid = root.querySelector('[aria-label="Tamaño del texto"]');
            const optionColumns = optionGrid
                ? getComputedStyle(optionGrid).gridTemplateColumns.split(' ').filter(Boolean).length
                : null;

            // Placeholders: color computado de ::placeholder contra su superficie.
            const placeholderFailures = [];
            for (const el of root.querySelectorAll('input[placeholder], textarea[placeholder]')) {
                if (!visible(el) || el.type === 'hidden') continue;
                const raw = getComputedStyle(el, '::placeholder').color;
                const fg = parseColor(raw);
                if (!fg) continue;
                const bg = solidBackground(el);
                const ratio = contrast(blend(fg, bg), bg);
                if (ratio < 4.5) {
                    placeholderFailures.push({
                        text: (el.getAttribute('placeholder') || '').slice(0, 40),
                        color: raw,
                        ratio: Math.round(ratio * 100) / 100,
                    });
                }
            }

            // Bordes visibles de controles y de sus wrappers: 3:1. También
            // falla un input/select/textarea sin ningún borde visible.
            const borderFailures = [];
            const measuredBorders = new Set();
            const readBorder = (el) => {
                const s = getComputedStyle(el);
                if (s.borderStyle === 'none' || parseFloat(s.borderTopWidth) < 1) return null;
                const fg = parseColor(s.borderTopColor);
                if (!fg || fg.a < 0.2) return null;
                const bg = solidBackground(el.parentElement || el);
                return { color: s.borderTopColor, ratio: contrast(blend(fg, bg), bg) };
            };
            const frameFor = (el) => {
                let node = el.parentElement;
                for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
                    if (node.matches('.control-frame, [class*="control-frame"]')) return node;
                }
                return null;
            };
            const judgeBorder = (target) => {
                if (!target || measuredBorders.has(target)) return;
                measuredBorders.add(target);
                const border = readBorder(target);
                if (!border) return;
                if (border.ratio < 3) {
                    borderFailures.push({
                        tag: target.tagName,
                        text: (target.innerText || target.getAttribute('aria-label') || target.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
                        color: border.color,
                        ratio: Math.round(border.ratio * 100) / 100,
                    });
                }
            };

            for (const el of root.querySelectorAll('.control-frame, [class*="control-frame"]')) {
                if (visible(el)) judgeBorder(el);
            }
            for (const el of root.querySelectorAll('button, input, select, textarea, label')) {
                if (!visible(el)) continue;
                if (el.tagName === 'LABEL' && !el.matches('.control-frame, [class*="control-frame"]') &&
                    !el.querySelector('input[type="radio"], input[type="checkbox"]')) {
                    continue;
                }
                const own = readBorder(el);
                if (own) {
                    judgeBorder(el);
                    continue;
                }
                const frame = frameFor(el);
                if (frame) {
                    judgeBorder(frame);
                    continue;
                }
                if (el.matches('input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]), select, textarea')) {
                    borderFailures.push({
                        tag: el.tagName,
                        text: (el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 40),
                        color: null,
                        ratio: 0,
                        reason: 'sin borde visible',
                    });
                }
            }

            // Controles tapados por el chrome fijo. El rect se recorta primero
            // por el scroller de main: si el control queda fuera de su caja,
            // no es un solape visible. Cualquier solape visible de un control
            // es fallo, no solo los críticos.
            const chromeOverlaps = [];
            const chromeUnderlay = [];
            const scrollerEl = document.querySelector('main#main');
            const scrollerStyle = scrollerEl ? getComputedStyle(scrollerEl) : null;
            const internalScroll = Boolean(
                scrollerEl && scrollerStyle && /(auto|scroll)/.test(scrollerStyle.overflowY)
            );
            const scrollTop = internalScroll ? scrollerEl.scrollTop : window.scrollY;
            if (!dialog && scrollTop <= 2) {
                const header = document.querySelector('header');
                const chromeRects = [];
                if (tabBarRect && tabBarRect.height > 0) chromeRects.push(['tab-bar', tabBarRect]);
                if (header) {
                    const hr = header.getBoundingClientRect();
                    if (hr.height > 0 && hr.top < 2) chromeRects.push(['header', hr]);
                }
                for (const el of root.querySelectorAll('[data-chrome-critical], button, a[href], input, select, textarea, label')) {
                    if (!visible(el)) continue;
                    if (el.closest('nav[aria-label="Navegación inferior"], header, [role="dialog"]')) continue;
                    const raw = el.getBoundingClientRect();
                    if (raw.bottom <= 0 || raw.top >= window.innerHeight) continue;
                    let floating = false;
                    for (let node = el; node && node !== document.body; node = node.parentElement) {
                        const position = getComputedStyle(node).position;
                        if (position === 'fixed' || position === 'sticky') { floating = true; break; }
                    }
                    const box = floating ? raw : effectiveRect(el);
                    if (!box || box.width < 2 || box.height < 2) continue;
                    const critical = el.hasAttribute('data-chrome-critical') || Boolean(el.closest('[data-chrome-critical]'));
                    for (const [name, chrome] of chromeRects) {
                        const x = Math.max(0, Math.min(box.right, chrome.right) - Math.max(box.left, chrome.left));
                        const y = Math.max(0, Math.min(box.bottom, chrome.bottom) - Math.max(box.top, chrome.top));
                        const area = x * y;
                        if (!area) continue;
                        const ratio = area / (box.width * box.height);
                        if (ratio <= 0.01) continue;
                        const entry = {
                            chrome: name,
                            tag: el.tagName,
                            text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
                            ratio: Math.round(ratio * 100),
                        };
                        if (critical) chromeOverlaps.push(entry);
                        else chromeUnderlay.push(entry);
                    }
                }
            }

            // Label in Name: el nombre accesible debe contener el texto visible.
            const labelMismatches = [];
            const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
            for (const el of root.querySelectorAll('button, a[href], [role="button"]')) {
                if (!visible(el)) continue;
                const visibleText = normalize(el.innerText);
                const label = normalize(el.getAttribute('aria-label'));
                if (!visibleText || !label) continue;
                // Los botones que solo muestran un glifo (+/−/×) no son texto
                // visible: su nombre accesible describe la acción.
                if (!/[0-9a-z\u00e0-\u00ff]/i.test(visibleText)) continue;
                if (!label.includes(visibleText)) {
                    labelMismatches.push({
                        tag: el.tagName,
                        text: visibleText.slice(0, 40),
                        label: label.slice(0, 60),
                    });
                }
            }
            // En campos, el placeholder visible que contiene palabras también
            // forma parte del nombre visible; los "Ej." y formatos se omiten.
            for (const el of root.querySelectorAll('input[aria-label][placeholder], textarea[aria-label][placeholder]')) {
                if (!visible(el)) continue;
                const visibleText = normalize(el.getAttribute('placeholder'));
                const label = normalize(el.getAttribute('aria-label'));
                if (!visibleText || !label) continue;
                if (/^ej\\./i.test(visibleText)) continue;
                if (!/[a-z\\u00e0-\\u00ff]{3,}/i.test(visibleText)) continue;
                if (!label.includes(visibleText)) {
                    labelMismatches.push({
                        tag: el.tagName,
                        text: visibleText.slice(0, 40),
                        label: label.slice(0, 60),
                    });
                }
            }

            // aria-controls solo puede apuntar a un panel que ya existe.
            const danglingControls = Array.from(root.querySelectorAll('[aria-controls]'))
                .filter(el => !document.getElementById(el.getAttribute('aria-controls')))
                .map(el => ({
                    tag: el.tagName,
                    controls: el.getAttribute('aria-controls'),
                    text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
                }));

            return {
                innerWidth: window.innerWidth,
                visualViewportWidth: window.visualViewport ? window.visualViewport.width : window.innerWidth,
                documentScrollWidth: document.documentElement.scrollWidth,
                clippedCount: clipped.length,
                clipped: clipped.slice(0, 12),
                overlapCount: overlaps.length,
                overlaps: overlaps.slice(0, 8),
                overlayCount: overlays.length,
                overlays: overlays.slice(0, 8),
                headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(el => ({
                    tag: el.tagName, text: (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 70)
                })),
                dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map(el => ({
                    label: el.getAttribute('aria-labelledby'), modal: el.getAttribute('aria-modal')
                })),
                brokenWordCount: brokenWords.length,
                brokenWords: brokenWords.slice(0, 12),
                headerHeight: Math.round(headerHeight),
                headerRatio: Math.round((headerHeight / window.innerHeight) * 1000) / 1000,
                saleTop: saleRect ? Math.round(saleRect.top) : null,
                saleVisible,
                saleAboveTabBar,
                tabBarVisible,
                tabBarTop: tabBarVisible ? Math.round(tabBarRect.top) : null,
                scrollY: Math.round(scrollTop),
                metaAmountVisible: Boolean(metaAmount),
                metaAmountText: metaAmount ? (metaAmount.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 70) : null,
                metaActionVisible: metaActionRect
                    ? metaActionRect.top < (tabBarVisible ? tabBarRect.top : window.innerHeight) &&
                      metaActionRect.bottom > 0 &&
                      (!tabBarVisible || metaActionRect.bottom <= tabBarRect.top + 1)
                    : null,
                chromeOverlapCount: chromeOverlaps.length,
                chromeOverlaps: chromeOverlaps.slice(0, 8),
                chromeUnderlayCount: chromeUnderlay.length,
                chromeUnderlay: chromeUnderlay.slice(0, 6),
                placeholderFailureCount: placeholderFailures.length,
                placeholderFailures: placeholderFailures.slice(0, 8),
                borderFailureCount: borderFailures.length,
                borderCheckedCount: measuredBorders.size,
                borderFailures: borderFailures.slice(0, 8),
                labelMismatchCount: labelMismatches.length,
                labelMismatches: labelMismatches.slice(0, 8),
                danglingControlCount: danglingControls.length,
                danglingControls: danglingControls.slice(0, 8),
                optionColumns,
                textCount: textEls.length,
                under12Count: textEls.filter(t => t.size < 12).length,
                under12: textEls.filter(t => t.size < 12).slice(0, 8),
                under14Count: textEls.filter(t => t.size < 14).length,
                under17Count: textEls.filter(t => t.size < 17).length,
                under48Count: targets.filter(t => t.width < 48 || t.height < 48).length,
                under48: targets.filter(t => t.width < 48 || t.height < 48).slice(0, 10),
                unnamedCount: unnamed.length
            };
        }"""
    )
    data["label"] = label
    return data


def measure_text200(page, label: str, shot_name: str, with_axe: bool = False) -> dict:
    style = page.add_style_tag(content="html { font-size: 200% !important; }")
    page.wait_for_timeout(500)
    data = measure(page, label)
    if with_axe:
        data["axe"] = run_axe(page)
    shot(page, shot_name)
    style.evaluate("el => el.remove()")
    page.wait_for_timeout(300)
    return data


def focus_sequence(page, steps: int = 6) -> list[dict]:
    seq = []
    for _ in range(steps):
        page.keyboard.press("Tab")
        page.wait_for_timeout(60)
        seq.append(
            page.evaluate(
                """() => {
                    const e = document.activeElement;
                    return {
                        tag: e.tagName,
                        text: (e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 50),
                        inDialog: Boolean(e.closest('[role="dialog"]'))
                    };
                }"""
            )
        )
    return seq


def tab_bar_metrics(page) -> dict:
    """Mide los labels reales de la tab bar, no el CSS declarado."""
    return page.evaluate(
        """() => {
            const bar = document.querySelector('.mobile-tabs');
            if (!bar) return null;
            const br = bar.getBoundingClientRect();
            const buttons = Array.from(bar.querySelectorAll('button'));
            const labels = buttons.map((button) => {
                const label = button.querySelector('.mobile-tab-label');
                const br2 = button.getBoundingClientRect();
                const lr = label ? label.getBoundingClientRect() : null;
                return {
                    text: label ? label.textContent.trim() : '',
                    size: label ? parseFloat(getComputedStyle(label).fontSize) : 0,
                    buttonWidth: Math.round(br2.width),
                    labelWidth: lr ? Math.round(lr.width) : 0,
                    fits: Boolean(lr && lr.width <= br2.width - 2),
                };
            });
            return {
                visible: br.height > 0 && getComputedStyle(bar).display !== 'none',
                innerWidth: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                height: Math.round(br.height),
                count: buttons.length,
                labels,
            };
        }"""
    )


def audit_viewport(page, context, w: int, h: int, full_flow: bool) -> dict:
    page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_selector("h1:has-text('Caja')", timeout=30000)
    try:
        page.wait_for_selector("text=Ventas registradas hoy", timeout=20000)
    except Exception:
        pass
    page.wait_for_timeout(500)

    record = {"viewport": f"{w}x{h}"}
    record["home"] = measure(page, "home")
    record["tabBar"] = tab_bar_metrics(page)
    record["homeAxe"] = run_axe(page)
    shot(page, f"home-{w}-fold")
    if w in (360, 390):
        shot(page, f"home-{w}-full", full=True)

    record["homeText200"] = measure_text200(
        page, "home-text-200", f"home-{w}-text200", with_axe=True
    )

    # Guía: foco, Escape y axe.
    page.get_by_role("button", name="Abrir guía").click()
    page.wait_for_timeout(300)
    record["help"] = measure(page, "help")
    record["helpAxe"] = run_axe(page)
    record["helpText200"] = measure_text200(page, "help-text-200", f"help-{w}-text200", with_axe=True)
    record["helpInitialFocus"] = page.evaluate(
        "Boolean(document.activeElement?.closest('[role=dialog]'))"
    )
    record["helpFocus"] = focus_sequence(page, 6)
    shot(page, f"help-{w}")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    record["helpClosedWithEscape"] = page.locator('[role="dialog"]').count() == 0
    if page.locator('[role="dialog"]').count():
        page.get_by_role("button", name="Cerrar").click()
        page.wait_for_timeout(200)

    # Modo demo.
    page.get_by_role("button", name="Demo", exact=True).click()
    page.wait_for_selector("text=Estás en modo demo", timeout=10000)
    page.wait_for_timeout(200)
    record["demoSheet"] = measure(page, "demo-sheet")
    record["demoSheetText200"] = measure_text200(page, "demo-sheet-text-200", f"demo-{w}-text200")
    shot(page, f"demo-{w}")
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)

    # Verificación anti-fraude.
    page.get_by_role("button", name="Verificar comprobante", exact=True).click()
    page.wait_for_selector("text=Pega el ID de la transacción", timeout=10000)
    page.get_by_role("button", name="Probar con un comprobante falso").click()
    page.wait_for_selector("text=No verificado", timeout=15000)
    page.wait_for_timeout(300)
    record["verify"] = measure(page, "verify-sheet")
    record["verifyAxe"] = run_axe(page)
    record["verifyText200"] = measure_text200(page, "verify-text-200", f"verify-{w}-text200", with_axe=True)
    shot(page, f"verify-{w}")
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)

    if full_flow:
        page.get_by_role("button", name="Dos quesadillas de 35 y un agua de 20").click()
        page.wait_for_selector("text=2 productos", timeout=15000)
        page.wait_for_timeout(800)
        record["draft"] = measure(page, "draft")
        shot(page, f"draft-{w}")
        page.get_by_role("button", name="Confirmar venta").click()
        page.wait_for_selector("text=Link de pago", timeout=15000)
        page.wait_for_timeout(500)
        record["payment"] = measure(page, "payment-sheet")
        record["paymentAxe"] = run_axe(page)
        record["paymentText200"] = measure_text200(page, "payment-text-200", f"payment-{w}-text200")
        shot(page, f"payment-{w}")
        page.get_by_role("button", name="Link de pago").click()
        page.wait_for_selector("text=Simular CoDi", timeout=15000)
        page.wait_for_timeout(400)
        record["link"] = measure(page, "link")
        shot(page, f"link-{w}")
        page.get_by_role("button", name="Simular CoDi").click()
        page.wait_for_selector("text=Pago demo (simulado)", timeout=15000)
        page.wait_for_timeout(400)
        record["paid"] = measure(page, "paid-sheet")
        record["paidAxe"] = run_axe(page)
        record["paidText200"] = measure_text200(page, "paid-text-200", f"paid-{w}-text200")
        record["paidDialogs"] = page.locator('[role="dialog"]').count()
        shot(page, f"paid-{w}")
        # `demo_paid` no se entrega (409 demo_not_deliverable); cierra la hoja
        # para seguir midiendo el resto de destinos.
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        for tab in ["Fiado", "Corte", "Meta"]:
            page.locator("button:visible", has_text=tab).first.click()
            page.wait_for_timeout(700)
            record[tab.lower()] = measure(page, tab.lower())
            shot(page, f"{tab.lower()}-{w}")
            record[f"{tab.lower()}Text200"] = measure_text200(
                page,
                f"{tab.lower()}-text-200",
                f"{tab.lower()}-{w}-text200",
                with_axe=(tab == "Meta"),
            )

        # Sheets de Fiado y confirmación de Corte al 200%.
        page.locator("button:visible", has_text="Fiado").first.click()
        page.wait_for_timeout(500)
        page.get_by_role("button", name="Registrar abono").first.click()
        page.wait_for_timeout(400)
        # El estado “Elegido” solo existe después de elegir método; hay que
        # medirlo y pasarle axe, no solo la hoja vacía.
        page.get_by_role("dialog").get_by_text("Efectivo", exact=True).click()
        page.wait_for_timeout(200)
        record["fiadoSheet"] = measure(page, "fiado-sheet")
        record["fiadoSheetAxe"] = run_axe(page)
        record["fiadoSheetText200"] = measure_text200(
            page, "fiado-sheet-text-200", f"fiado-sheet-{w}-text200", with_axe=True
        )
        shot(page, f"fiado-sheet-{w}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
        if page.get_by_role("button", name="Descartar abono").count():
            page.get_by_role("button", name="Descartar abono").click()
        page.wait_for_timeout(300)

        page.locator("button:visible", has_text="Corte").first.click()
        page.wait_for_timeout(500)
        # P0-D bloquea base > contado. Usamos un conteo válido con diferencia
        # para abrir la confirmación sin activar la validación de bloqueo.
        page.get_by_label("Total contado en pesos").fill("600")
        page.wait_for_timeout(300)
        page.get_by_role("button", name="Guardar corte").first.click()
        page.wait_for_timeout(400)
        record["corteConfirm"] = measure(page, "corte-confirm")
        record["corteConfirmText200"] = measure_text200(page, "corte-confirm-text-200", f"corte-confirm-{w}-text200")
        shot(page, f"corte-confirm-{w}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        page.locator("button:visible", has_text="Caja").first.click()
        page.wait_for_timeout(400)

    # Checkout público.
    context.request.post(f"{BASE}/api/demo/reset")
    dashboard = context.request.get(f"{BASE}/api/dashboard").json()
    pending = next((o for o in dashboard["orders"] if o["status"] == "payment_pending"), None)
    if pending:
        page.goto(f"{BASE}/pay/{pending['id']}", wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("text=¿Cómo quieres pagar?", timeout=20000)
        page.wait_for_timeout(400)
        record["checkout"] = measure(page, "checkout")
        record["checkoutAxe"] = run_axe(page)
        shot(page, f"checkout-{w}")
        style = page.add_style_tag(content="html { font-size: 200% !important; }")
        page.wait_for_timeout(400)
        record["checkoutText200"] = measure(page, "checkout-text-200")
        shot(page, f"checkout-{w}-text200")
        style.evaluate("el => el.remove()")
        page.locator("button", has_text="Pagar").last.click()
        page.wait_for_selector("h1:has-text('Pago')", timeout=20000)
        page.wait_for_timeout(400)
        record["checkoutPaid"] = measure(page, "checkout-paid")
        record["checkoutPaidAxe"] = run_axe(page)
        shot(page, f"checkout-{w}-paid")
        style = page.add_style_tag(content="html { font-size: 200% !important; }")
        page.wait_for_timeout(400)
        record["checkoutPaidText200"] = measure(page, "checkout-paid-text-200")
        shot(page, f"checkout-{w}-paid-text200")
        style.evaluate("el => el.remove()")

        page.goto(f"{BASE}/pay/{pending['id']}/success", wait_until="domcontentloaded", timeout=45000)
        # La espera no depende de que el estado sea “pagado”: también debe
        # funcionar el estado honesto de un cobro inexistente.
        page.wait_for_selector("main h1", timeout=20000)
        record["successChecked"] = True
        record["successHasStatus"] = page.locator("section[role=status]").count() >= 1
        page.wait_for_timeout(500)
        record["successPage"] = measure(page, "success-page")
        record["successPageAxe"] = run_axe(page)
        record["successPageText200"] = measure_text200(page, "success-page-text-200", f"success-{w}-text200")
        shot(page, f"success-{w}")

    context.request.post(f"{BASE}/api/demo/reset")
    return record


def main() -> int:
    started = time.time()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for w, h in VIEWPORTS:
            print(f"\nVIEWPORT {w}x{h}")
            context = browser.new_context(
                viewport={"width": w, "height": h},
                device_scale_factor=2 if w <= 390 else 1,
                is_mobile=w <= 390,
                has_touch=w <= 390,
                locale="es-MX",
            )
            page = context.new_page()
            errors: list[str] = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            try:
                record = audit_viewport(page, context, w, h, full_flow=w in (320, 360, 390, 768, 1280))
                record["consoleErrors"] = errors
                results.append(record)
                home = record["home"]
                print(
                    f"  scroll={home['documentScrollWidth']}/{home['innerWidth']} "
                    f"under12={home['under12Count']} under48={home['under48Count']} "
                    f"axe={len(record['homeAxe']['violations'])} "
                    f"200={record['homeText200']['documentScrollWidth']} "
                    f"focus={record['helpInitialFocus']} escape={record['helpClosedWithEscape']} "
                    f"errors={len(errors)}"
                )
            except Exception as exc:
                print("  ERROR", type(exc).__name__, exc)
                results.append({"viewport": f"{w}x{h}", "error": str(exc)})
            finally:
                context.close()
        browser.close()

    report = {
        "base": BASE,
        "started": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsedSeconds": round(time.time() - started, 1),
        "code": code_info(),
        "viewports": results,
    }
    path = OUT / "audit.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # Gate: any serious/critical axe violation, horizontal overflow, clipped
    # non-intentional text, overlapping targets, chrome-overlapped controls,
    # sub-12px text or sub-44px target fails. Axe moderate/minor se guardan en
    # el JSON como deuda revisable, pero no bloquean el gate (política explícita
    # en HIG-DESIGN §10); serious/critical sí lo bloquean.
    failures: list[str] = []
    for record in results:
        view = record.get("viewport", "?")
        if "error" in record:
            failures.append(f"{view}: audit crashed: {record['error']}")
            continue
        tab_bar = record.get("tabBar") or {}
        if tab_bar.get("visible"):
            if tab_bar.get("count") != 5:
                failures.append(f"{view} tab bar: {tab_bar.get('count')} tabs en vez de 5")
            if tab_bar.get("scrollWidth", 0) > tab_bar.get("innerWidth", 0) + 1:
                failures.append(
                    f"{view} tab bar: overflow {tab_bar.get('scrollWidth')}>{tab_bar.get('innerWidth')}"
                )
            for label in tab_bar.get("labels", []):
                if label.get("size", 0) < 12:
                    failures.append(
                        f"{view} tab bar: “{label.get('text')}” mide {label.get('size')} px (<12)"
                    )
                if not label.get("fits"):
                    failures.append(
                        f"{view} tab bar: “{label.get('text')}” no cabe en su botón "
                        f"({label.get('labelWidth')}>{label.get('buttonWidth') - 2})"
                    )
        if record.get("successChecked") and not record.get("successHasStatus"):
            failures.append(f"{view} success: falta section[role=status]")
        for key, value in record.items():
            if isinstance(value, dict) and "violations" in value:
                for violation in value["violations"]:
                    if violation.get("impact") in ("serious", "critical"):
                        failures.append(
                            f"{view} {key}: axe {violation['impact']} {violation['id']} ({violation['nodes']} nodes)"
                        )
            if isinstance(value, dict) and isinstance(value.get("axe"), dict):
                for violation in value["axe"].get("violations", []):
                    if violation.get("impact") in ("serious", "critical"):
                        failures.append(
                            f"{view} {key} 200%: axe {violation['impact']} {violation['id']} ({violation['nodes']} nodes)"
                        )
            if isinstance(value, dict) and "documentScrollWidth" in value:
                if value["documentScrollWidth"] > value["innerWidth"] + 1:
                    failures.append(
                        f"{view} {key}: horizontal overflow {value['documentScrollWidth']}>{value['innerWidth']}"
                    )
                if value["innerWidth"] > value.get("visualViewportWidth", value["innerWidth"]) + 1:
                    failures.append(
                        f"{view} {key}: layout viewport expanded {value['innerWidth']}>{round(value.get('visualViewportWidth', value['innerWidth']))}"
                    )
                for clip in value.get("clipped", []):
                    if not clip.get("intentional"):
                        failures.append(f"{view} {key}: clipped {clip['reason']} “{clip['text']}”")
                if value.get("overlapCount", 0) > 0:
                    for overlap in value.get("overlaps", []):
                        failures.append(
                            f"{view} {key}: overlap {overlap['ratio']}% “{overlap['a']}” / “{overlap['b']}”"
                        )
                if value.get("under12Count", 0) > 0:
                    failures.append(
                        f"{view} {key}: {value['under12Count']} textos bajo 12 px"
                    )
                if value.get("under48Count", 0) > 0:
                    failures.append(f"{view} {key}: {value['under48Count']} targets under 44px")
                if value.get("unnamedCount", 0) > 0:
                    failures.append(f"{view} {key}: {value['unnamedCount']} controles sin nombre accesible")
                if value.get("brokenWordCount", 0) > 0:
                    words = ", ".join(
                        f"“{item['word']}” en “{item['text']}”" for item in value.get("brokenWords", [])[:4]
                    )
                    failures.append(f"{view} {key}: {value['brokenWordCount']} palabras partidas ({words})")
                if value.get("chromeOverlapCount", 0) > 0:
                    for item in value.get("chromeOverlaps", []):
                        failures.append(
                            f"{view} {key}: control tapado por {item['chrome']} al {item['ratio']}% “{item['text']}”"
                        )
                if value.get("chromeUnderlayCount", 0) > 0:
                    for item in value.get("chromeUnderlay", []):
                        failures.append(
                            f"{view} {key}: control bajo {item['chrome']} al {item['ratio']}% “{item['text']}”"
                        )
                if value.get("placeholderFailureCount", 0) > 0:
                    for item in value.get("placeholderFailures", []):
                        failures.append(
                            f"{view} {key}: placeholder {item['ratio']}:1 “{item['text']}”"
                        )
                if value.get("borderFailureCount", 0) > 0:
                    for item in value.get("borderFailures", []):
                        failures.append(
                            f"{view} {key}: borde de control {item.get('ratio')}:1 en {item['tag']} “{item['text']}”"
                            + (f" ({item['reason']})" if item.get("reason") else "")
                        )
                if value.get("labelMismatchCount", 0) > 0:
                    for item in value.get("labelMismatches", []):
                        failures.append(
                            f"{view} {key}: Label in Name “{item['text']}” / “{item['label']}”"
                        )
                if value.get("danglingControlCount", 0) > 0:
                    for item in value.get("danglingControls", []):
                        failures.append(
                            f"{view} {key}: aria-controls colgante “{item['controls']}” en “{item['text']}”"
                        )
                width = int(view.split("x")[0]) if "x" in view else 0
                if key == "homeText200":
                    if width <= 390 and value.get("headerRatio", 0) > 0.30:
                        failures.append(
                            f"{view} {key}: header ocupa {round(value['headerRatio'] * 100)}% del viewport"
                        )
                    if width in (320, 360, 390, 768) and value.get("saleVisible") is False:
                        failures.append(f"{view} {key}: el campo de venta no aparece en el primer viewport")
                if key == "helpText200" and (value.get("optionColumns") or 0) > 2:
                    failures.append(
                        f"{view} {key}: controles de texto/velocidad en {value['optionColumns']} columnas"
                    )
                if key == "metaText200":
                    if not value.get("metaAmountVisible"):
                        failures.append(f"{view} {key}: no se ve la cifra de la meta")
                    if not value.get("metaActionVisible"):
                        failures.append(
                            f"{view} {key}: Apartar no queda completo por encima de la tab bar "
                            f"(tabTop={value.get('tabBarTop')})"
                        )
        if record.get("consoleErrors"):
            failures.append(f"{view}: {len(record['consoleErrors'])} console errors: {record['consoleErrors'][:2]}")

    report["failures"] = failures
    report["axePolicy"] = (
        "serious/critical bloquean; moderate/minor se guardan en el JSON y se "
        "revisan como deuda, sin bloquear el gate"
    )
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    if failures:
        print(f"\nFALLÓ: {len(failures)} hallazgos")
        for failure in failures:
            print("  -", failure)
        return 1

    print("\nPASÓ: sin violaciones serias, recortes, controles bajo el chrome ni overflow.")
    print(f"HIG OK: {len(VIEWPORTS)} viewports")
    return 0


if __name__ == "__main__":
    sys.exit(main())
