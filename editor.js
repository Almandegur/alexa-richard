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
  var STORE_KEY = 'inviteEditChangeset_v11';  // bumped after baking date scale 0.8 + 16px up -> clean slate
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
  var addImgBtn = document.getElementById('addImgBtn');
  var fontSel = document.getElementById('fontSel');
  var wRange = document.getElementById('wRange');
  var wNum = document.getElementById('wNum');
  var fontField = document.getElementById('fontField');
  var widthField = document.getElementById('widthField');
  var txtField = document.getElementById('txtField');
  var fsField = document.getElementById('fsField');
  var scaleField = document.getElementById('scaleField');
  var scaleRange = document.getElementById('scaleRange');
  var scaleNum = document.getElementById('scaleNum');
  var vwNum = document.getElementById('vwNum');

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
    // cache-bust on every load so we always fetch the freshest build;
    // nogate=1 disables the opening-cover gate so the editor shows ALL content (cover+main+form)
    frame.src = p + '?_cb=' + Date.now() + '&nogate=1';
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
      // our own injected images are directly selectable (normally images are skipped)
      if (el && el.tagName && el.tagName.toLowerCase() === 'img' &&
          el.classList && el.classList.contains('__editimg')) return el;
      // DATE: ANY click inside the date section selects ONE canonical block (the tn-elem holding
      // .tdr-root) so the size/position is always recorded on a single key (no duplicate entries).
      var dn = el;
      while (dn && dn.nodeType === 1) {
        if (dn.id === 'rec2190837343') {
          var de = doc.querySelector('#rec2190837343 .tn-elem[data-elem-id="1776856626015"]');
          if (de) return de;
          break;
        }
        dn = dn.parentElement;
      }
      var node = el;
      while (node && node.nodeType === 1) {
        if (node.classList && (node.classList.contains('tn-atom') ||
            node.classList.contains('lab') || node.classList.contains('w1') ||
            node.classList.contains('w2') || node.classList.contains('amp') ||
            node.classList.contains('nm') || node.classList.contains('ev') ||
            node.classList.contains('dgname') || node.classList.contains('bsr-orn'))) {
          return node;  // bsr-orn = the gold ornament/flourish divs (selectable + draggable)
        }
        node = node.parentElement;
      }
      // fallback: any text-bearing element, so EVERY text is selectable (not just Tilda atoms)
      node = el;
      while (node && node.nodeType === 1 && node !== doc.body) {
        var tg = node.tagName.toLowerCase();
        if (tg !== 'img' && tg !== 'svg' && tg !== 'script' && tg !== 'style' &&
            (node.textContent || '').trim()) return node;
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
        '.__edit_on .bsr-sched .lab,.__edit_on .bsr-sched .ev,' +
        '.__edit_on .bsr-hosts .lab,' +
        '.__edit_on .bsr-hosts .nm,.__edit_on .bsr-hosts .nm .w1,.__edit_on .bsr-hosts .nm .w2,.__edit_on .bsr-hosts .nm .amp,' +
        '.__edit_on #bsr-card h2,.__edit_on #bsr-card .bsr-sub,.__edit_on #bsr-card label,' +
        '.__edit_on .dgname,.__edit_on .dgname .w1,.__edit_on .dgname .w2,.__edit_on .dgname .amp{cursor:pointer!important;}' +
        // every text-bearing custom block becomes hit-testable in edit mode
        '.__edit_on .bsr-sched,.__edit_on .bsr-sched *,.__edit_on .bsr-hosts,.__edit_on .bsr-hosts *,' +
        '.__edit_on .dgname,.__edit_on .dgname *,.__edit_on #bsr-card,.__edit_on #bsr-card *{pointer-events:auto!important;}' +
        // gold ornaments / flourishes -> hit-testable so they can be selected, nudged, and dragged
        '.__edit_on .bsr-orn,.__edit_on .bsr-orn *{pointer-events:auto!important;cursor:pointer!important;}' +
        // venue title ships with pointer-events:none (so the photo is a map link); re-enable it for editing
        '.__edit_on #rec2047657203 .tn-elem[data-elem-id="1776866271348000001"],.__edit_on #rec2047657203 .tn-elem[data-elem-id="1776866271348000001"] .tn-atom{pointer-events:auto!important;cursor:pointer!important;}' +
        // hero couple name sits over the photo with z-index games; force it hit-testable so Бек/Софья are selectable
        '.__edit_on #rec2047601243 [data-elem-id="1776948176126"],.__edit_on #rec2047601243 [data-elem-id="1776948176126"] *{pointer-events:auto!important;}' +
        '.__edit_on #rec2047601243 [data-elem-id="1776948176126"] .w1,.__edit_on #rec2047601243 [data-elem-id="1776948176126"] .w2{cursor:pointer!important;}' +
        // DATE SQUARES (Option-10 tiles): hit-testable + draggable in edit mode (whole date block moves)
        '.__edit_on #rec2190837343 .tdr-root,.__edit_on #rec2190837343 .tdr-root *{pointer-events:auto!important;}' +
        '.__edit_on #rec2190837343 .tdr-tile,.__edit_on #rec2190837343 .tdr-panels,.__edit_on #rec2190837343 .tdr-num{cursor:pointer!important;}' +
        // show the opening cover/seal as a CONTAINED top section in the editor (matches the live opening,
        // and since it is the first section the hero still sits below it, so couple names stay clickable)
        '#rec2292029533.bsr-on{position:relative!important;inset:auto!important;left:auto!important;top:auto!important;right:auto!important;width:100%!important;height:660px!important;z-index:1!important;display:block!important;}' +
        '#rec2292029533.bsr-on.bsr-hide,#rec2292029533.bsr-gone{display:block!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;}' +
        '#rec2292029533.bsr-on .t396__artboard{height:660px!important;min-height:660px!important;}' +
        '.__edit_on .__editimg{pointer-events:auto!important;cursor:pointer!important;}' +
        '.__edit_hover{outline:2px dashed #6ea8ff!important;outline-offset:1px;}' +
        '.__edit_sel{outline:2px solid #37c98b!important;outline-offset:1px;background:rgba(55,201,139,.08)!important;}';
      doc.head.appendChild(st);
    }

    // force the opening cover/seal to render (the page skips it under ?nogate) so the editor shows it like live
    (function showCover(){
      var cov = doc.getElementById('rec2292029533');
      if (!cov) return;
      cov.classList.add('bsr-on');
      cov.classList.remove('bsr-hide', 'bsr-gone');
      var ab = cov.querySelector('.t396__artboard');
      if (ab && !ab.querySelector('.bsr-ctitle')) {
        var t = doc.createElement('div');
        t.className = 'bsr-ctitle';
        t.innerHTML = '<span class="t1">ҮЙЛӨНҮҮ ТОЙГО</span><span class="t2">Чакыруу</span>';
        ab.appendChild(t);
      }
    })();

    // expose an API on the iframe window
    var API = win.__editAPI = win.__editAPI || {};
    API.keyFor = keyFor;
    API.resolveKey = resolveKey;

    // font stacks the page actually ships (so a toggle matches the live look)
    var FONT_STACKS = {
      cursive: "'Florisel','Bad Script',cursive",
      vibes: "'Great Vibes','FloriseRef','Florisel',cursive",
      classic: "'PT Serif',serif",
      'classic-italic': "'PT Serif',serif"
    };
    function applyFontFamily(el, val) {
      if (!val) { el.style.removeProperty('font-family'); el.style.removeProperty('font-style'); return; }
      el.style.setProperty('font-family', FONT_STACKS[val] || val, 'important');
      el.style.setProperty('font-style', val === 'classic-italic' ? 'italic' : 'normal', 'important');
    }
    function applyWidth(el, px) {
      if (!px) { el.style.removeProperty('width'); el.style.removeProperty('max-width'); return; }
      el.style.setProperty('width', px + 'px', 'important');
      el.style.setProperty('max-width', 'none', 'important');
    }
    // DATE squares size: scale the whole .tdr-root (keeps the build's translateY + top origin)
    function applyDateScale(s) {
      var dr = doc.querySelector('#rec2190837343 .tdr-root');
      if (!dr) return;
      dr.style.setProperty('transform', 'translateY(5px) scale(' + s + ')', 'important');
      dr.style.setProperty('transform-origin', 'center top', 'important');
    }
    API.setScale = function (s) { applyDateScale(s); };

    // apply a stored change to an element (used on load + live)
    API.applyChange = function (key, ch) {
      var el = resolveKey(key);
      if (!el) return false;
      if (typeof ch.text === 'string') setText(el, ch.text);
      if (typeof ch.fontSize === 'number') el.style.setProperty('font-size', ch.fontSize + 'px', 'important');
      if (typeof ch.fontFamily === 'string') applyFontFamily(el, ch.fontFamily);
      if (typeof ch.width === 'number') applyWidth(el, ch.width);
      if (typeof ch.scale === 'number') applyDateScale(ch.scale);
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
      var droot = el.querySelector ? el.querySelector('.tdr-root') : null;
      var dscale = 1;
      if (droot) {
        var mt = win.getComputedStyle(droot).transform;
        if (mt && mt.indexOf('matrix') === 0) {
          var sa = parseFloat(mt.slice(mt.indexOf('(') + 1).split(',')[0]);
          if (sa) dscale = Math.round(sa * 100) / 100;
        }
      }
      win.parent.__editOnSelect({
        key: key,
        text: API.getText(el),
        fontSize: API.getFontSize(el),
        dx: parseFloat(el.dataset.editDx || ch.dx || 0) || 0,
        dy: parseFloat(el.dataset.editDy || ch.dy || 0) || 0,
        tag: el.tagName.toLowerCase(),
        cls: el.getAttribute('class') || '',
        width: Math.round(parseFloat(win.getComputedStyle(el).width) || 0),
        isImg: el.tagName.toLowerCase() === 'img',
        isDate: !!droot,
        scale: dscale
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
    API.setFontFamily = function (val) { if (selEl) applyFontFamily(selEl, val); };
    API.setWidth = function (px) { if (selEl) applyWidth(selEl, px); };
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
      el.style.removeProperty('display');
      el.style.removeProperty('font-family');
      el.style.removeProperty('font-style');
      el.style.removeProperty('width');
      el.style.removeProperty('max-width');
      delete el.dataset.editDx; delete el.dataset.editDy;
      // text revert requires reload; signal parent
    };
    // create a new text box, append it, and select it
    API.createBox = function () {
      var d = doc.createElement('div');
      d.id = '__editnew_' + Date.now();
      d.className = '__editnew';
      d.textContent = 'New text';
      d.style.cssText = "position:absolute;left:28%;z-index:99999;font-family:'PT Serif',serif;font-size:24px;color:#1a1a1a;background:rgba(255,255,255,.55);padding:4px 8px;cursor:pointer;";
      d.style.top = ((win.scrollY || 0) + 120) + 'px';
      doc.body.appendChild(d);
      selectEl(d);
      return keyFor(d);
    };
    // add an image element (URL), absolute-positioned, draggable + resizable, and select it
    API.createImage = function (src) {
      var im = doc.createElement('img');
      im.id = '__editimg_' + Date.now();
      im.className = '__editnew __editimg';
      im.src = src; im.alt = '';
      im.style.cssText = "position:absolute;left:28%;width:160px;height:auto;z-index:99999;display:block;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);";
      im.style.top = ((win.scrollY || 0) + 120) + 'px';
      doc.body.appendChild(im);
      selectEl(im);
      return keyFor(im);
    };
    // hide an element (delete); recorded by the parent for export
    API.deleteEl = function (key) {
      var el = resolveKey(key);
      if (el) el.style.setProperty('display', 'none', 'important');
      if (selEl === el) selEl = null;
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
    // font-family + width pulled from the live changeset (falls back to the element's computed width)
    var stored = (changeset[page] && changeset[page][info.key]) || {};
    fontSel.value = stored.fontFamily || '';
    var w = (typeof stored.width === 'number') ? stored.width : (info.width || 0);
    wRange.value = Math.min(w, parseInt(wRange.max, 10)); wNum.value = w;
    // DATE squares: show the size (scale) control only for the date block
    var isDate = !!info.isDate;
    if (scaleField) {
      scaleField.style.display = isDate ? '' : 'none';
      var sc = (typeof stored.scale === 'number') ? stored.scale : (info.scale || 1);
      if (scaleRange) scaleRange.value = sc;
      if (scaleNum) scaleNum.value = sc;
    }
    // images: hide the text + font controls (not applicable), keep width as the resize control
    var isImg = !!info.isImg;
    txtField.style.display = isImg ? 'none' : '';
    fsField.style.display = isImg ? 'none' : '';
    fontField.style.display = isImg ? 'none' : '';
    var db = document.getElementById('delBtn');
    if (db) db.textContent = isImg ? 'Delete this image' : 'Delete this text box';
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
    var hasFam = typeof e.fontFamily === 'string';
    var hasW = typeof e.width === 'number';
    var hasScale = typeof e.scale === 'number';
    if (!hasText && !hasFs && !hasOff && !hasFam && !hasW && !hasScale && !e.created && !e.deleted && !e.image) delete pc[key];
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
  function recordFontFamily(key, val) {
    var e = ensureEntry(key);
    if (!val) { delete e.fontFamily; } else { e.fontFamily = val; }
    pruneIfEmpty(key); saveStore(); refreshCount();
  }
  function recordWidth(key, px, origPx) {
    var e = ensureEntry(key);
    if (!px || Math.abs(px - origPx) < 0.5) { delete e.width; }
    else { e.width = px; if (e.origWidth === undefined) e.origWidth = origPx; }
    pruneIfEmpty(key); saveStore(); refreshCount();
  }
  function recordScale(key, s, origS) {
    var e = ensureEntry(key);
    if (Math.abs(s - (origS || 1)) < 0.005) { delete e.scale; }
    else { e.scale = s; if (e.origScale === undefined) e.origScale = origS; }
    pruneIfEmpty(key); saveStore(); refreshCount();
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

  fontSel.addEventListener('change', function () {
    if (!current) return;
    var a = api(); if (a) a.setFontFamily(fontSel.value);
    recordFontFamily(current.key, fontSel.value);
  });
  function applyW(px) {
    if (!current) return;
    px = Math.max(0, Math.min(2000, px || 0));
    wRange.value = Math.min(px, parseInt(wRange.max, 10)); wNum.value = px;
    var a = api(); if (a) a.setWidth(px);
    recordWidth(current.key, px, current.width || 0);
  }
  wRange.addEventListener('input', function () { applyW(parseFloat(wRange.value)); });
  wNum.addEventListener('input', function () { applyW(parseFloat(wNum.value)); });
  function applyScaleVal(s) {
    if (!current) return;
    s = Math.max(0.3, Math.min(1.5, s || 1));
    if (scaleRange) scaleRange.value = s;
    if (scaleNum) scaleNum.value = s;
    var a = api(); if (a && a.setScale) a.setScale(s);
    recordScale(current.key, s, (current.scale || 1));
  }
  if (scaleRange) scaleRange.addEventListener('input', function () { applyScaleVal(parseFloat(scaleRange.value)); });
  if (scaleNum) scaleNum.addEventListener('input', function () { applyScaleVal(parseFloat(scaleNum.value)); });

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

  // ---------- create / delete text box ----------
  var addTextBtn = document.getElementById('addTextBtn');
  var delBtn = document.getElementById('delBtn');
  addTextBtn.addEventListener('click', function () {
    if (!editOn) { editOn = true; setEditBtn(); }
    var a = api(); if (!a) return;
    a.setEditMode(true);
    var key = a.createBox();
    if (key) {
      var e = ensureEntry(key); e.created = true; e.text = 'New text';
      saveStore(); refreshCount();
      showToast('Text box added — edit it on the right');
    }
  });
  addImgBtn.addEventListener('click', function () {
    var src = prompt('Image URL (https://… or a file already in the repo like venue.jpg):', '');
    if (!src) return;
    if (!editOn) { editOn = true; setEditBtn(); }
    var a = api(); if (!a) return;
    a.setEditMode(true);
    var key = a.createImage(src.trim());
    if (key) {
      var e = ensureEntry(key); e.created = true; e.image = true; e.src = src.trim(); e.width = 160;
      saveStore(); refreshCount();
      showToast('Image added — drag to position, set width on the right');
    }
  });
  delBtn.addEventListener('click', function () {
    if (!current) { showToast('Nothing selected'); return; }
    var a = api(); if (a) a.deleteEl(current.key);
    var e = ensureEntry(current.key);
    e.deleted = true; delete e.text; delete e.fontSize; delete e.dx; delete e.dy;
    saveStore(); refreshCount();
    clearSelectionUI();
    showToast('Deleted (recorded for export)');
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
          if (e.created) o.created = true;
          if (e.deleted) o.deleted = true;
          if (e.image) { o.image = true; o.src = e.src; }
          if (typeof e.text === 'string') o.text = e.text;
          if (typeof e.fontSize === 'number') o.fontSizePx = e.fontSize;
          if (typeof e.fontFamily === 'string') o.fontFamily = e.fontFamily;
          if (typeof e.width === 'number') o.widthPx = e.width;
          if (typeof e.scale === 'number') o.scale = e.scale;
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
        if (e.deleted) { lines.push('• DELETE  ' + k); lines.push(''); return; }
        lines.push((e.created ? (e.image ? '• ADD image  ' : '• ADD text box  ') : '• ') + k);
        if (typeof e.text === 'string') {
          lines.push('    text: ' + JSON.stringify(e.origText !== undefined ? e.origText : '') +
                     '  ->  ' + JSON.stringify(e.text));
        }
        if (e.image && e.src) {
          lines.push('    image src: ' + e.src);
        }
        if (typeof e.fontSize === 'number') {
          var from = e.origFontSize !== undefined ? (Math.round(e.origFontSize * 10) / 10) + 'px' : '?';
          lines.push('    font-size: ' + from + '  ->  ' + e.fontSize + 'px');
        }
        if (typeof e.fontFamily === 'string') {
          lines.push('    font-family: -> ' + e.fontFamily + '  (cursive=Florisel script, vibes=Great Vibes, classic=PT Serif)');
        }
        if (typeof e.width === 'number') {
          var fw = e.origWidth !== undefined ? Math.round(e.origWidth) + 'px' : '?';
          lines.push('    width: ' + fw + '  ->  ' + e.width + 'px');
        }
        if (typeof e.scale === 'number') {
          var fsc = e.origScale !== undefined ? e.origScale : 1;
          lines.push('    scale: ' + fsc + '  ->  ' + e.scale + '   (date squares size; bake into #rec2190837343 .tdr-root scale)');
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
    lines.push('font-family   -> set the family on the element CSS (cursive=script, classic=PT Serif).');
    lines.push('width         -> set width (px) on the element; controls wrapping / clipping.');
    lines.push('image         -> add an <img> in build.py at the shown offset + width.');
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

  // ---------- preview width (set to YOUR phone for an exact match to the live transition) ----------
  function setFrameWidth(px) {
    px = Math.max(280, Math.min(900, px || 390));
    frame.style.width = px + 'px';
    var fw = document.getElementById('frameWrap');
    if (fw) fw.style.width = px + 'px';
  }
  if (vwNum) {
    vwNum.addEventListener('input', function () { setFrameWidth(parseInt(vwNum.value, 10)); });
    setFrameWidth(parseInt(vwNum.value, 10) || 390);
  }

  // ---------- boot ----------
  refreshCount();
  loadPage(page);
})();
