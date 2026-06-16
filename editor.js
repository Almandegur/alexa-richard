/* Invite Edit Mode - standalone dev tool.
 * Loads kg.html / kz.html in an iframe (same origin), injects an edit overlay,
 * lets you select/edit/resize/nudge text elements, and exports a changeset.
 * Creates no dependency, modifies no source file.
 */
(function () {
  'use strict';

  // ---------- parent-side state ----------
  var PAGES = ['kg.html', 'kz.html', 'index.html'];
  var qs = new URLSearchParams(location.search);
  var page = qs.get('page') || 'kg.html';
  if (PAGES.indexOf(page) === -1) page = 'kg.html';

  // changeset: { page: { key: { text, fontSize, dx, dy, orig:{...} } } }
  var STORE_KEY = 'inviteEditChangeset_v1';
  var changeset = loadStore();

  var frame = document.getElementById('frame');
  var pageBtns = document.getElementById('pageBtns');
  var editToggle = document.getElementById('editToggle');
  var changeCount = document.getElementById('changeCount');
  var emptyMsg = document.getElementById('emptyMsg');
  var controls = document.getElementById('controls');
  var selKey = document.getElementById('selKey');
  var txtInput = document.getElementById('txtInput');
  var txtHint = document.getElementById('txtHint');
  var fsRange = document.getElementById('fsRange');
  var fsNum = document.getElementById('fsNum');
  var stepNum = document.getElementById('stepNum');
  var offReadout = document.getElementById('offReadout');
  var exportBtn = document.getElementById('exportBtn');
  var exportWrap = document.getElementById('exportWrap');
  var exportText = document.getElementById('exportText');
  var exportFmt = document.getElementById('exportFmt');
  var exportCount = document.getElementById('exportCount');
  var copyBtn = document.getElementById('copyBtn');
  var clearBtn = document.getElementById('clearBtn');
  var exportClose = document.getElementById('exportClose');
  var resetSelBtn = document.getElementById('resetSelBtn');
  var toast = document.getElementById('toast');

  var editOn = false;
  var current = null; // { key, el } from the iframe

  function setActivePageBtn() {
    var btns = pageBtns.querySelectorAll('.pgbtn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-page') === page);
    }
  }
  setActivePageBtn();

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(changeset)); } catch (e) {}
  }
  function pageChanges() {
    if (!changeset[page]) changeset[page] = {};
    return changeset[page];
  }
  function totalChanges() {
    var n = 0;
    Object.keys(changeset).forEach(function (p) {
      n += Object.keys(changeset[p] || {}).length;
    });
    return n;
  }
  function refreshCount() { changeCount.textContent = totalChanges(); }

  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.remove('show'); }, 1400);
  }

  // ---------- load page ----------
  function loadPage(p) {
    page = p;
    setActivePageBtn();
    var url = new URL(location.href);
    url.searchParams.set('page', p);
    history.replaceState(null, '', url);
    editOn = false; setEditBtn();
    clearSelectionUI();
    // cache-bust on every load so we always fetch the freshest build
    frame.src = p + '?_cb=' + Date.now();
  }

  frame.addEventListener('load', function () {
    injectIntoFrame();
    refreshCount();
  });

  pageBtns.addEventListener('click', function (e) {
    var btn = e.target.closest('.pgbtn');
    if (!btn) return;
    loadPage(btn.getAttribute('data-page'));
  });

  // ---------- the injected agent (runs inside the iframe) ----------
  // We add it as a property of the iframe window and call it. It posts messages back.
  function injectIntoFrame() {
    var win, doc;
    try {
      win = frame.contentWindow;
      doc = frame.contentDocument || (win && win.document);
    } catch (e) {
      console.error('[editor] cannot access iframe (cross-origin?)', e);
      return;
    }
    if (!doc) { console.error('[editor] no iframe document'); return; }

    // build a stable selector key for an element
    function keyFor(el) {
      var f = el.getAttribute && el.getAttribute('field');
      if (f && /tn_text_/.test(f)) return 'field:' + f;
      // custom blocks: bsr-sched/.lab, bsr-hosts/.lab, dgname/.w1
      return 'css:' + cssPath(el);
    }
    function cssPath(el) {
      var parts = [];
      var node = el;
      while (node && node.nodeType === 1 && node !== doc.body && parts.length < 6) {
        var sel = node.tagName.toLowerCase();
        var cls = (node.getAttribute('class') || '').trim().split(/\s+/)
          .filter(function (c) {
            return c && !/^t[0-9]/.test(c) && c !== 'tn-atom' &&
                   c !== '__edit_sel' && c !== '__edit_hover';
          });
        if (node.id) { sel += '#' + node.id; parts.unshift(sel); break; }
        if (cls.length) sel += '.' + cls.slice(0, 2).join('.');
        // nth-of-type for stability
        var i = 1, sib = node;
        while ((sib = sib.previousElementSibling)) {
          if (sib.tagName === node.tagName) i++;
        }
        sel += ':nth-of-type(' + i + ')';
        parts.unshift(sel);
        node = node.parentElement;
      }
      return parts.join(' > ');
    }
    function resolveKey(key) {
      if (key.indexOf('field:') === 0) {
        var f = key.slice(6);
        return doc.querySelector("[field='" + f + "'], [field=\"" + f + "\"]");
      }
      if (key.indexOf('css:') === 0) {
        try { return doc.querySelector(key.slice(4)); } catch (e) { return null; }
      }
      return null;
    }

    // Is el an editable text target? Has text and no element children with text-bearing role.
    function isTextTarget(el) {
      if (!el || el.nodeType !== 1) return false;
      if (el.id === '__edit_style__') return false;
      var tag = el.tagName.toLowerCase();
      if (tag === 'html' || tag === 'body' || tag === 'script' || tag === 'style' ||
          tag === 'img' || tag === 'svg' || tag === 'br' || tag === 'video') return false;
      var t = (el.textContent || '').trim();
      if (!t) return false;
      // prefer leaf-ish: no child element that itself has visible text larger than tiny
      var childElems = el.children;
      for (var i = 0; i < childElems.length; i++) {
        var c = childElems[i];
        if ((c.textContent || '').trim().length > 0 &&
            c.tagName.toLowerCase() !== 'br') {
          // has a text-bearing child -> not a leaf; let the click bubble to child
          // unless this is a tn-atom (Tilda text atoms hold formatted spans)
          if (!el.classList.contains('tn-atom') &&
              !el.classList.contains('lab') &&
              !el.classList.contains('w1') &&
              !el.classList.contains('w2')) {
            return false;
          }
        }
      }
      return true;
    }

    // climb to the best target (tn-atom / lab / w1/w2) if clicked on inner span
    function bestTarget(el) {
      var node = el;
      while (node && node.nodeType === 1) {
        if (node.classList && (node.classList.contains('tn-atom') ||
            node.classList.contains('lab') || node.classList.contains('w1') ||
            node.classList.contains('w2') || node.classList.contains('dgname'))) {
          return node;
        }
        node = node.parentElement;
      }
      return isTextTarget(el) ? el : null;
    }

    // edit overlay styles + behavior
    var st = doc.getElementById('__edit_style__');
    if (!st) {
      st = doc.createElement('style');
      st.id = '__edit_style__';
      st.textContent =
        '.__edit_on [field^="tn_text_"],' +
        '.__edit_on .tn-atom,' +
        '.__edit_on .bsr-sched .lab,' +
        '.__edit_on .bsr-hosts .lab,' +
        '.__edit_on .dgname{cursor:pointer!important;}' +
        '.__edit_on .bsr-sched,.__edit_on .bsr-hosts{pointer-events:auto!important;}' +
        '.__edit_hover{outline:2px dashed #6ea8ff!important;outline-offset:1px;}' +
        '.__edit_sel{outline:2px solid #37c98b!important;outline-offset:1px;background:rgba(55,201,139,.08)!important;}';
      doc.head.appendChild(st);
    }

    // expose an API on the iframe window
    var API = win.__editAPI = win.__editAPI || {};
    API.keyFor = keyFor;
    API.resolveKey = resolveKey;

    // apply a stored change to an element (used on load + live)
    API.applyChange = function (key, ch) {
      var el = resolveKey(key);
      if (!el) return false;
      if (typeof ch.text === 'string') setText(el, ch.text);
      if (typeof ch.fontSize === 'number') el.style.setProperty('font-size', ch.fontSize + 'px', 'important');
      applyOffset(el, ch.dx || 0, ch.dy || 0);
      return true;
    };
    function setText(el, text) {
      // If the atom wraps formatted spans, replace innerHTML text content gently:
      // simplest robust approach -> set textContent (loses inner formatting but
      // these atoms are single-style text). Preserve <br> by converting newlines.
      var html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                     .replace(/\n/g, '<br>');
      el.innerHTML = html;
    }
    function applyOffset(el, dx, dy) {
      el.dataset.editDx = dx; el.dataset.editDy = dy;
      // preserve any existing transform that came from Tilda by stashing it once
      if (el.dataset.editBaseTransform === undefined) {
        var cs = win.getComputedStyle(el).transform;
        el.dataset.editBaseTransform = (cs && cs !== 'none') ? cs : '';
      }
      var base = el.dataset.editBaseTransform || '';
      var t = (base ? base + ' ' : '') + 'translate(' + dx + 'px,' + dy + 'px)';
      el.style.setProperty('transform', t, 'important');
    }
    API.getFontSize = function (el) {
      return parseFloat(win.getComputedStyle(el).fontSize) || 16;
    };
    API.getText = function (el) {
      // turn <br> back into newlines for the editor
      var clone = el.cloneNode(true);
      var brs = clone.querySelectorAll('br');
      for (var i = 0; i < brs.length; i++) brs[i].replaceWith('\n');
      return (clone.textContent || '').replace(/\s+\n/g, '\n').trim();
    };

    // re-apply any stored changes for this page
    var pc = (window.parent.__editChangesetFor && window.parent.__editChangesetFor(page)) || {};
    Object.keys(pc).forEach(function (k) { API.applyChange(k, pc[k]); });

    // ---------- hover + click + drag in edit mode ----------
    var hoverEl = null, selEl = null;
    var dragging = false, dragStart = null, dragBase = null;

    function setEditMode(on) {
      doc.body.classList.toggle('__edit_on', on);
      if (!on) { clearHover(); /* keep selection styling off */ }
    }
    API.setEditMode = setEditMode;

    API.selectKey = function (key) {
      var el = resolveKey(key);
      if (el) selectEl(el);
    };
    API.clearSel = function () {
      if (selEl) selEl.classList.remove('__edit_sel');
      selEl = null;
    };

    function clearHover() {
      if (hoverEl) hoverEl.classList.remove('__edit_hover');
      hoverEl = null;
    }
    function selectEl(el) {
      if (selEl) selEl.classList.remove('__edit_sel');
      selEl = el; el.classList.add('__edit_sel');
      var key = keyFor(el);
      var ch = pc[key] || {};
      win.parent.__editOnSelect({
        key: key,
        text: API.getText(el),
        fontSize: API.getFontSize(el),
        dx: parseFloat(el.dataset.editDx || ch.dx || 0) || 0,
        dy: parseFloat(el.dataset.editDy || ch.dy || 0) || 0,
        tag: el.tagName.toLowerCase(),
        cls: el.getAttribute('class') || ''
      });
    }

    doc.addEventListener('mouseover', function (e) {
      if (!doc.body.classList.contains('__edit_on')) return;
      var t = bestTarget(e.target);
      if (t === hoverEl) return;
      clearHover();
      if (t && t !== selEl) { hoverEl = t; t.classList.add('__edit_hover'); }
    }, true);

    doc.addEventListener('mouseout', function () {
      if (!doc.body.classList.contains('__edit_on')) return;
      clearHover();
    }, true);

    doc.addEventListener('click', function (e) {
      if (!doc.body.classList.contains('__edit_on')) return;
      var t = bestTarget(e.target);
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      clearHover();
      selectEl(t);
    }, true);

    // drag the selected element
    doc.addEventListener('mousedown', function (e) {
      if (!doc.body.classList.contains('__edit_on')) return;
      var t = bestTarget(e.target);
      if (!t || t !== selEl) return;
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      dragBase = {
        dx: parseFloat(selEl.dataset.editDx || 0) || 0,
        dy: parseFloat(selEl.dataset.editDy || 0) || 0
      };
      e.preventDefault();
    }, true);
    doc.addEventListener('mousemove', function (e) {
      if (!dragging || !selEl) return;
      var ndx = dragBase.dx + (e.clientX - dragStart.x);
      var ndy = dragBase.dy + (e.clientY - dragStart.y);
      applyOffset(selEl, ndx, ndy);
      win.parent.__editOnDrag(Math.round(ndx), Math.round(ndy));
    }, true);
    doc.addEventListener('mouseup', function () {
      if (!dragging || !selEl) { dragging = false; return; }
      dragging = false;
      var key = keyFor(selEl);
      win.parent.__editCommitOffset(key,
        Math.round(parseFloat(selEl.dataset.editDx || 0)),
        Math.round(parseFloat(selEl.dataset.editDy || 0)));
    }, true);

    // live setters called from parent panel
    API.setText = function (text) {
      if (!selEl) return;
      setText(selEl, text);
    };
    API.setFontSize = function (px) {
      if (!selEl) return;
      selEl.style.setProperty('font-size', px + 'px', 'important');
    };
    API.nudge = function (dx, dy) {
      if (!selEl) return null;
      var ndx = (parseFloat(selEl.dataset.editDx || 0) || 0) + dx;
      var ndy = (parseFloat(selEl.dataset.editDy || 0) || 0) + dy;
      applyOffset(selEl, ndx, ndy);
      return { dx: ndx, dy: ndy };
    };
    API.revert = function (key) {
      var el = resolveKey(key);
      if (!el) return;
      el.style.removeProperty('font-size');
      el.style.removeProperty('transform');
      delete el.dataset.editDx; delete el.dataset.editDy;
      // text revert requires reload; signal parent
    };

    // turn on edit mode if it was on (page switch keeps it off by default)
    setEditMode(editOn);
    console.log('[editor] injected OK into', page);
  }

  // ---------- bridges the iframe calls (must be on window) ----------
  window.__editChangesetFor = function (p) { return changeset[p] || {}; };

  window.__editOnSelect = function (info) {
    current = info;
    emptyMsg.style.display = 'none';
    controls.style.display = 'block';
    selKey.textContent = info.key;
    txtInput.value = info.text;
    txtHint.textContent = info.text.length + ' chars · <' + info.tag + '>';
    var fs = Math.round(info.fontSize * 10) / 10;
    fsRange.value = fs; fsNum.value = fs;
    offReadout.textContent = 'offset: ' + Math.round(info.dx) + ', ' + Math.round(info.dy) + ' px';
  };
  window.__editOnDrag = function (dx, dy) {
    offReadout.textContent = 'offset: ' + dx + ', ' + dy + ' px';
  };
  window.__editCommitOffset = function (key, dx, dy) {
    recordOffset(key, dx, dy);
  };

  function api() {
    try { return frame.contentWindow.__editAPI; } catch (e) { return null; }
  }

  // ---------- record helpers (parent changeset) ----------
  function ensureEntry(key) {
    var pc = pageChanges();
    if (!pc[key]) pc[key] = {};
    return pc[key];
  }
  function pruneIfEmpty(key) {
    var pc = pageChanges();
    var e = pc[key];
    if (!e) return;
    var hasText = typeof e.text === 'string';
    var hasFs = typeof e.fontSize === 'number';
    var hasOff = (e.dx || e.dy);
    if (!hasText && !hasFs && !hasOff) delete pc[key];
  }
  function recordText(key, text, origText) {
    var e = ensureEntry(key);
    if (text === origText) { delete e.text; }
    else { e.text = text; if (e.origText === undefined) e.origText = origText; }
    pruneIfEmpty(key); saveStore(); refreshCount();
  }
  function recordFs(key, px, origPx) {
    var e = ensureEntry(key);
    if (Math.abs(px - origPx) < 0.05) { delete e.fontSize; }
    else { e.fontSize = px; if (e.origFontSize === undefined) e.origFontSize = origPx; }
    pruneIfEmpty(key); saveStore(); refreshCount();
  }
  function recordOffset(key, dx, dy) {
    var e = ensureEntry(key);
    if (!dx && !dy) { delete e.dx; delete e.dy; }
    else { e.dx = dx; e.dy = dy; }
    pruneIfEmpty(key); saveStore(); refreshCount();
    if (current && current.key === key) {
      offReadout.textContent = 'offset: ' + dx + ', ' + dy + ' px';
    }
  }

  // ---------- panel controls ----------
  editToggle.addEventListener('click', function () {
    editOn = !editOn; setEditBtn();
    var a = api(); if (a) a.setEditMode(editOn);
  });
  function setEditBtn() {
    editToggle.textContent = 'Edit: ' + (editOn ? 'ON' : 'OFF');
    editToggle.classList.toggle('on', editOn);
  }

  txtInput.addEventListener('input', function () {
    if (!current) return;
    var a = api(); if (a) a.setText(txtInput.value);
    txtHint.textContent = txtInput.value.length + ' chars · <' + current.tag + '>';
    recordText(current.key, txtInput.value, current.text);
  });

  function applyFs(px) {
    if (!current) return;
    px = Math.max(4, Math.min(200, px));
    fsRange.value = px; fsNum.value = px;
    var a = api(); if (a) a.setFontSize(px);
    recordFs(current.key, px, current.fontSize);
  }
  fsRange.addEventListener('input', function () { applyFs(parseFloat(fsRange.value)); });
  fsNum.addEventListener('input', function () { applyFs(parseFloat(fsNum.value)); });

  document.querySelectorAll('.nudge .btn').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!current) return;
      var step = parseInt(stepNum.value, 10) || 1;
      var dx = parseInt(b.dataset.dx, 10) * step;
      var dy = parseInt(b.dataset.dy, 10) * step;
      var a = api(); if (!a) return;
      var r = a.nudge(dx, dy);
      if (r) { recordOffset(current.key, Math.round(r.dx), Math.round(r.dy)); }
    });
  });

  resetSelBtn.addEventListener('click', function () {
    if (!current) { showToast('Nothing selected'); return; }
    var a = api(); if (a) a.revert(current.key);
    delete pageChanges()[current.key];
    saveStore(); refreshCount();
    // text revert needs reload to restore source text
    showToast('Reverted (reload page for original text)');
    // re-pull from element
    var el = a && a.resolveKey(current.key);
    if (el) {
      var fs = Math.round((a.getFontSize(el)) * 10) / 10;
      fsRange.value = fs; fsNum.value = fs;
      offReadout.textContent = 'offset: 0, 0 px';
    }
  });

  // ---------- export ----------
  function buildExport(fmt) {
    var lines = [];
    var json = {};
    var anyP = Object.keys(changeset).filter(function (p) {
      return Object.keys(changeset[p] || {}).length;
    });
    if (!anyP.length) return fmt === 'json' ? '{}' : 'No changes recorded yet.';

    if (fmt === 'json') {
      anyP.forEach(function (p) {
        json[p] = {};
        Object.keys(changeset[p]).forEach(function (k) {
          var e = changeset[p][k]; var o = {};
          if (typeof e.text === 'string') o.text = e.text;
          if (typeof e.fontSize === 'number') o.fontSizePx = e.fontSize;
          if (e.dx || e.dy) o.offsetPx = { dx: e.dx || 0, dy: e.dy || 0 };
          json[p][k] = o;
        });
      });
      return JSON.stringify(json, null, 2);
    }

    // readable notes
    anyP.forEach(function (p) {
      lines.push('===== ' + p + ' =====');
      var pc = changeset[p];
      Object.keys(pc).forEach(function (k) {
        var e = pc[k];
        lines.push('• ' + k);
        if (typeof e.text === 'string') {
          lines.push('    text: ' + JSON.stringify(e.origText !== undefined ? e.origText : '') +
                     '  ->  ' + JSON.stringify(e.text));
        }
        if (typeof e.fontSize === 'number') {
          var from = e.origFontSize !== undefined ? (Math.round(e.origFontSize * 10) / 10) + 'px' : '?';
          lines.push('    font-size: ' + from + '  ->  ' + e.fontSize + 'px');
        }
        if (e.dx || e.dy) {
          lines.push('    offset: translate(' + (e.dx || 0) + 'px, ' + (e.dy || 0) + 'px)');
        }
        lines.push('');
      });
    });
    lines.push('--- Notes for dev ---');
    lines.push('text changes  -> edit the matching field in content.py / source.');
    lines.push('font-size     -> set on the element (px). For tn_text fields, the Tilda');
    lines.push('                 atom rule; for .bsr-/.dgname, the custom CSS block.');
    lines.push('offset        -> a visual translate() to apply; convert to top/left or');
    lines.push('                 margin in source as appropriate.');
    return lines.join('\n');
  }

  function openExport() {
    exportText.value = buildExport(exportFmt.value);
    exportCount.textContent = totalChanges() + ' change(s)';
    exportWrap.classList.add('show');
  }
  exportBtn.addEventListener('click', openExport);
  exportFmt.addEventListener('change', function () {
    exportText.value = buildExport(exportFmt.value);
  });
  exportClose.addEventListener('click', function () { exportWrap.classList.remove('show'); });
  exportWrap.addEventListener('click', function (e) {
    if (e.target === exportWrap) exportWrap.classList.remove('show');
  });
  copyBtn.addEventListener('click', function () {
    exportText.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    if (navigator.clipboard) {
      navigator.clipboard.writeText(exportText.value).then(
        function () { showToast('Copied to clipboard'); },
        function () { showToast(ok ? 'Copied' : 'Select + Cmd-C to copy'); });
    } else {
      showToast(ok ? 'Copied to clipboard' : 'Select + Cmd-C to copy');
    }
  });
  clearBtn.addEventListener('click', function () {
    if (!confirm('Clear ALL recorded changes (all pages)? This cannot be undone.')) return;
    changeset = {}; saveStore(); refreshCount();
    exportText.value = buildExport(exportFmt.value);
    exportCount.textContent = '0 change(s)';
    showToast('Cleared. Reload to discard live edits.');
  });

  function clearSelectionUI() {
    current = null;
    controls.style.display = 'none';
    emptyMsg.style.display = 'block';
  }

  // ---------- boot ----------
  refreshCount();
  loadPage(page);
})();
