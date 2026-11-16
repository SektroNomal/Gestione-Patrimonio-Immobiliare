/* Grafici SVG leggeri senza dipendenze (GPI.CHARTS). Tutte le funzioni restituiscono HTML/SVG come stringa. */
(function (G) {
  'use strict';
  var U = G.U, CH = {};
  CH.PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#64748b', '#0d9488', '#a16207'];
  CH.color = function (i) { return CH.PALETTE[i % CH.PALETTE.length]; };

  function esc(s) { return U.esc(s); }
  function f1(x) { return (Math.round(x * 10) / 10).toString(); }
  function niceStep(range, n) {
    var raw = range / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  }
  function scale(min, max, n, keepMin) {
    if (!(isFinite(min) && isFinite(max))) { min = 0; max = 1; }
    if (!keepMin && min > 0) min = 0;
    if (max < 0) max = 0;
    if (max === min) max = min + (Math.abs(min) || 1);
    var step = niceStep(max - min, n || 5), lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, ticks = [], v;
    for (v = lo; v <= hi + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
    return { lo: lo, hi: hi, ticks: ticks };
  }
  function empty(h, msg) { return '<div class="chart-empty" style="min-height:' + h + 'px">' + esc(msg || 'Nessun dato da visualizzare') + '</div>'; }
  function svgOpen(W, H, title) {
    return '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img"' + (title ? ' aria-label="' + esc(title) + '"' : '') + '>';
  }
  function legend(items) {
    return '<div class="chart-legend">' + items.map(function (s, i) {
      return '<span class="lg"><i style="background:' + (s.color || CH.color(i)) + (s.dash ? ';opacity:.6' : '') + '"></i>' + esc(s.name || s.label || '') + '</span>';
    }).join('') + '</div>';
  }
  function axes(out, sc, y, padL, W, padR, fmt) {
    sc.ticks.forEach(function (t) {
      var yy = f1(y(t));
      out.push('<line class="ch-grid' + (t === 0 ? ' ch-zero' : '') + '" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"/>');
      out.push('<text class="ch-txt" x="' + (padL - 6) + '" y="' + f1(y(t) + 4) + '" text-anchor="end">' + esc(fmt ? fmt(t) : U.fmtCompact(t)) + '</text>');
    });
  }
  function xLabels(out, labels, xc, H, padB, iw) {
    var every = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(iw / 52))));
    labels.forEach(function (l, i) {
      if (i % every === 0) out.push('<text class="ch-txt" x="' + f1(xc(i)) + '" y="' + (H - padB + 16) + '" text-anchor="middle">' + esc(l) + '</text>');
    });
  }

  /* Barre raggruppate o impilate (valori anche negativi).
     data = {labels, series:[{name, values, color}]}; o = {height, width, stacked, fmt, axisFmt, line:{name, values, color}, legend, empty} */
  CH.bar = function (data, o) {
    o = o || {};
    var labels = data.labels || [], series = (data.series || []).filter(function (s) { return s && s.values; });
    var H = o.height || 240, W = o.width || 680, padL = 58, padR = 12, padT = 12, padB = 34, i, j;
    if (!labels.length || !series.length) return empty(H, o.empty);
    var min = 0, max = 0, fv = o.fmt || function (v) { return U.fmtEur(v); };
    for (i = 0; i < labels.length; i++) {
      if (o.stacked) {
        var sp = 0, sn = 0;
        for (j = 0; j < series.length; j++) { var vv = +series[j].values[i] || 0; if (vv > 0) sp += vv; else sn += vv; }
        max = Math.max(max, sp); min = Math.min(min, sn);
      } else for (j = 0; j < series.length; j++) { max = Math.max(max, +series[j].values[i] || 0); min = Math.min(min, +series[j].values[i] || 0); }
      if (o.line && isFinite(o.line.values[i])) { max = Math.max(max, o.line.values[i]); min = Math.min(min, o.line.values[i]); }
    }
    var sc = scale(min, max, 5), iw = W - padL - padR, ih = H - padT - padB;
    var y = function (v) { return padT + ih * (sc.hi - v) / (sc.hi - sc.lo); };
    var bw = iw / labels.length, gap = Math.min(14, bw * 0.22), inner = bw - gap;
    var xc = function (k) { return padL + k * bw + bw / 2; };
    var out = [svgOpen(W, H, o.title)];
    axes(out, sc, y, padL, W, padR, o.axisFmt);
    for (i = 0; i < labels.length; i++) {
      var x0 = padL + i * bw + gap / 2, accP = 0, accN = 0;
      for (j = 0; j < series.length; j++) {
        var s = series[j], v = +s.values[i] || 0, col = s.color || CH.color(j), x, w, y0, y1;
        if (!v) continue;
        if (o.stacked) {
          w = inner; x = x0;
          if (v > 0) { y0 = y(accP + v); y1 = y(accP); accP += v; } else { y0 = y(accN); y1 = y(accN + v); accN += v; }
        } else { w = inner / series.length; x = x0 + j * w; y0 = y(Math.max(0, v)); y1 = y(Math.min(0, v)); }
        out.push('<rect x="' + f1(x) + '" y="' + f1(y0) + '" width="' + f1(Math.max(1, w - (o.stacked ? 0 : 1))) + '" height="' + f1(Math.max(0.6, y1 - y0)) +
          '" fill="' + col + '" rx="2"><title>' + esc(labels[i] + ' – ' + (s.name || '') + ': ' + fv(v)) + '</title></rect>');
      }
    }
    if (o.line) {
      var pts = [];
      for (i = 0; i < labels.length; i++) if (isFinite(o.line.values[i])) pts.push([xc(i), y(o.line.values[i]), o.line.values[i], labels[i]]);
      if (pts.length) {
        var lc = o.line.color || '#64748b';
        out.push('<polyline class="ch-line" fill="none" stroke="' + lc + '" stroke-width="2" points="' + pts.map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join(' ') + '"/>');
        pts.forEach(function (p) { out.push('<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="3" fill="' + lc + '"><title>' + esc(p[3] + ' – ' + (o.line.name || '') + ': ' + fv(p[2])) + '</title></circle>'); });
      }
    }
    xLabels(out, labels, xc, H, padB, iw);
    out.push('</svg>');
    var lg = series.slice();
    if (o.line) lg.push({ name: o.line.name, color: o.line.color || '#64748b' });
    return '<div class="chart">' + out.join('') + (o.legend === false || lg.length < 2 ? '' : legend(lg)) + '</div>';
  };

  /* Linee (con area opzionale). data = {labels, series:[{name, values, color, area, dash}]}; o = {height, width, fmt, axisFmt, keepMin, empty} */
  CH.line = function (data, o) {
    o = o || {};
    var labels = data.labels || [], series = (data.series || []).filter(function (s) { return s && s.values; });
    var H = o.height || 240, W = o.width || 680, padL = 58, padR = 14, padT = 12, padB = 34;
    if (!labels.length || !series.length) return empty(H, o.empty);
    var min = Infinity, max = -Infinity, fv = o.fmt || function (v) { return U.fmtEur(v); };
    series.forEach(function (s) { s.values.forEach(function (v) { if (isFinite(v) && v !== null) { min = Math.min(min, v); max = Math.max(max, v); } }); });
    if (min === Infinity) return empty(H, o.empty);
    var sc = scale(min, max, 5, o.keepMin), iw = W - padL - padR, ih = H - padT - padB;
    var y = function (v) { return padT + ih * (sc.hi - v) / (sc.hi - sc.lo); };
    var xc = function (k) { return labels.length < 2 ? padL + iw / 2 : padL + iw * k / (labels.length - 1); };
    var out = [svgOpen(W, H, o.title)], dots = labels.length <= 40;
    axes(out, sc, y, padL, W, padR, o.axisFmt);
    series.forEach(function (s, j) {
      var col = s.color || CH.color(j), pts = [];
      s.values.forEach(function (v, i) { if (isFinite(v) && v !== null) pts.push([xc(i), y(v), v, labels[i]]); });
      if (!pts.length) return;
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1]); }).join(' ');
      if (s.area) {
        var base = f1(y(Math.max(sc.lo, Math.min(0, sc.hi))));
        out.push('<path d="' + d + ' L' + f1(pts[pts.length - 1][0]) + ' ' + base + ' L' + f1(pts[0][0]) + ' ' + base + ' Z" fill="' + col + '" opacity="0.12"/>');
      }
      out.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2.2"' + (s.dash ? ' stroke-dasharray="6 4"' : '') + ' stroke-linejoin="round"/>');
      if (dots) pts.forEach(function (p) { out.push('<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="3.2" fill="' + col + '"><title>' + esc(p[3] + ' – ' + (s.name || '') + ': ' + fv(p[2])) + '</title></circle>'); });
    });
    xLabels(out, labels, xc, H, padB, iw);
    out.push('</svg>');
    return '<div class="chart">' + out.join('') + (o.legend === false || series.length < 2 ? '' : legend(series)) + '</div>';
  };

  /* Ciambella. items = [{label, value, color}]; o = {size, fmt, center, sub, empty, legend} */
  CH.donut = function (items, o) {
    o = o || {};
    var list = (items || []).filter(function (x) { return x && x.value > 0; }), tot = U.sum(list, function (x) { return x.value; });
    var size = o.size || 170, r = size / 2 - 3, ri = r * 0.6, c = size / 2, fv = o.fmt || function (v) { return U.fmtEur(v); };
    if (!tot) return empty(size, o.empty);
    var a0 = -Math.PI / 2, out = ['<svg class="chart-svg donut" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img">'];
    var pt = function (rad, a) { return f1(c + rad * Math.cos(a)) + ' ' + f1(c + rad * Math.sin(a)); };
    list.forEach(function (x, i) {
      var frac = x.value / tot, a1 = a0 + frac * Math.PI * 2, col = x.color || CH.color(i);
      var t = '<title>' + esc(x.label + ': ' + fv(x.value) + ' (' + U.fmtPct(frac) + ')') + '</title>';
      if (frac > 0.9999) out.push('<circle cx="' + c + '" cy="' + c + '" r="' + f1((r + ri) / 2) + '" fill="none" stroke="' + col + '" stroke-width="' + f1(r - ri) + '">' + t + '</circle>');
      else {
        var lg = a1 - a0 > Math.PI ? 1 : 0;
        out.push('<path d="M' + pt(r, a0) + ' A' + r + ' ' + r + ' 0 ' + lg + ' 1 ' + pt(r, a1) + ' L' + pt(ri, a1) + ' A' + f1(ri) + ' ' + f1(ri) + ' 0 ' + lg + ' 0 ' + pt(ri, a0) + ' Z" fill="' + col + '">' + t + '</path>');
      }
      x._c = col; x._f = frac; a0 = a1;
    });
    if (o.center) out.push('<text class="ch-center" x="' + c + '" y="' + f1(c + (o.sub ? 0 : 5)) + '" text-anchor="middle">' + esc(o.center) + '</text>');
    if (o.sub) out.push('<text class="ch-txt" x="' + c + '" y="' + f1(c + 17) + '" text-anchor="middle">' + esc(o.sub) + '</text>');
    out.push('</svg>');
    var leg = o.legend === false ? '' : '<ul class="donut-legend">' + list.map(function (x) {
      return '<li><i style="background:' + x._c + '"></i><span class="dl-l">' + esc(x.label) + '</span><span class="dl-v">' + esc(fv(x.value)) + '</span><span class="dl-p">' + U.fmtPct(x._f, 0) + '</span></li>';
    }).join('') + '</ul>';
    return '<div class="chart chart-donut">' + out.join('') + leg + '</div>';
  };

  /* Mini grafico di tendenza */
  CH.spark = function (values, o) {
    o = o || {};
    var v = (values || []).filter(function (x) { return isFinite(x) && x !== null; }), W = o.width || 110, H = o.height || 28;
    if (v.length < 2) return '';
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), rg = mx - mn || 1;
    var pts = v.map(function (x, i) { return f1(2 + (W - 4) * i / (v.length - 1)) + ',' + f1(H - 2 - (H - 4) * (x - mn) / rg); }).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true"><polyline fill="none" stroke="' + (o.color || '#2563eb') + '" stroke-width="1.8" points="' + pts + '"/></svg>';
  };

  /* Barre orizzontali in HTML (classifiche). items = [{label, value, sub, color, href}]; o = {fmt, max} */
  CH.hbars = function (items, o) {
    o = o || {};
    var fv = o.fmt || function (v) { return U.fmtEur(v); }, list = (items || []).filter(function (x) { return x && isFinite(x.value); });
    if (!list.length) return empty(60, o.empty);
    var mx = o.max || Math.max.apply(null, list.map(function (x) { return Math.abs(x.value); })) || 1;
    return '<div class="hbars">' + list.map(function (x, i) {
      var w = Math.min(100, Math.abs(x.value) / mx * 100), col = x.color || (x.value < 0 ? '#dc2626' : CH.color(i % 1));
      var lab = x.href ? '<a href="' + esc(x.href) + '">' + esc(x.label) + '</a>' : esc(x.label);
      return '<div class="hb"><div class="hb-l" title="' + esc(x.label) + '">' + lab + (x.sub ? ' <small>' + esc(x.sub) + '</small>' : '') + '</div>' +
        '<div class="hb-t"><div class="hb-b" style="width:' + f1(w) + '%;background:' + col + '"></div></div><div class="hb-v">' + esc(fv(x.value)) + '</div></div>';
    }).join('') + '</div>';
  };

  G.CHARTS = CH;
})(window.GPI = window.GPI || {});
