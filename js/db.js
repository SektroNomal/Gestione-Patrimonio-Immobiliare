/* Archivio locale: IndexedDB con fallback su localStorage e memoria (GPI.DB) */
(function (G) {
  'use strict';
  var DB = {}, db = null, mode = 'idb', mem = { properties: {}, kv: {} };
  var path = (location.pathname || '/').replace(/[^/]*$/, '');
  var NAME = 'GestionePatrimonio:' + path;
  var LS_PREFIX = 'gpi:' + path + ':';

  function req2p(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function tx(store, rw) { return db.transaction(store, rw ? 'readwrite' : 'readonly').objectStore(store); }
  function txDone(t) { return new Promise(function (res, rej) { t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error || new Error('Transazione annullata')); }; }); }

  function lsLoad() {
    try {
      var p = JSON.parse(localStorage.getItem(LS_PREFIX + 'properties') || '{}');
      var k = JSON.parse(localStorage.getItem(LS_PREFIX + 'kv') || '{}');
      mem.properties = p || {}; mem.kv = k || {};
    } catch (e) { mem = { properties: {}, kv: {} }; }
  }
  function lsSave(store) {
    if (mode !== 'ls') return;
    try { localStorage.setItem(LS_PREFIX + store, JSON.stringify(mem[store])); }
    catch (e) { G.U.toast('Spazio locale esaurito: esporta un backup!', 'error', 8000); throw e; }
  }

  DB.mode = function () { return mode; };

  DB.init = function () {
    return new Promise(function (resolve) {
      if (!window.indexedDB) return fallback(resolve);
      var r;
      try { r = indexedDB.open(NAME, 1); } catch (e) { return fallback(resolve); }
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('properties')) d.createObjectStore('properties', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'key' });
      };
      r.onsuccess = function () { db = r.result; mode = 'idb'; db.onversionchange = function () { db.close(); }; resolve(mode); };
      r.onerror = function () { fallback(resolve); };
      r.onblocked = function () { fallback(resolve); };
    });
  };
  function fallback(resolve) {
    try { localStorage.setItem(LS_PREFIX + 'test', '1'); localStorage.removeItem(LS_PREFIX + 'test'); mode = 'ls'; lsLoad(); }
    catch (e) { mode = 'mem'; }
    resolve(mode);
  }

  DB.getAll = function () {
    if (mode !== 'idb') return Promise.resolve(Object.keys(mem.properties).map(function (k) { return G.U.clone(mem.properties[k]); }));
    return req2p(tx('properties').getAll());
  };
  DB.put = function (p) {
    if (mode !== 'idb') { mem.properties[p.id] = G.U.clone(p); lsSave('properties'); return Promise.resolve(p); }
    return req2p(tx('properties', true).put(p)).then(function () { return p; });
  };
  DB.putMany = function (arr) {
    if (mode !== 'idb') { arr.forEach(function (p) { mem.properties[p.id] = G.U.clone(p); }); lsSave('properties'); return Promise.resolve(arr.length); }
    var t = db.transaction('properties', 'readwrite'), s = t.objectStore('properties');
    arr.forEach(function (p) { s.put(p); });
    return txDone(t).then(function () { return arr.length; });
  };
  DB.del = function (id) { return DB.delMany([id]); };
  DB.delMany = function (ids) {
    if (mode !== 'idb') { ids.forEach(function (id) { delete mem.properties[id]; }); lsSave('properties'); return Promise.resolve(ids.length); }
    var t = db.transaction('properties', 'readwrite'), s = t.objectStore('properties');
    ids.forEach(function (id) { s.delete(id); });
    return txDone(t).then(function () { return ids.length; });
  };
  DB.clear = function () {
    if (mode !== 'idb') { mem.properties = {}; lsSave('properties'); return Promise.resolve(); }
    return req2p(tx('properties', true).clear());
  };
  DB.getKV = function (key) {
    if (mode !== 'idb') return Promise.resolve(mem.kv[key] === undefined ? null : G.U.clone(mem.kv[key]));
    return req2p(tx('kv').get(key)).then(function (r) { return r ? r.value : null; });
  };
  DB.setKV = function (key, value) {
    if (mode !== 'idb') { mem.kv[key] = G.U.clone(value); lsSave('kv'); return Promise.resolve(); }
    return req2p(tx('kv', true).put({ key: key, value: value }));
  };
  DB.persist = function () {
    if (navigator.storage && navigator.storage.persist) return navigator.storage.persist().catch(function () { return false; });
    return Promise.resolve(false);
  };
  DB.persisted = function () {
    if (navigator.storage && navigator.storage.persisted) return navigator.storage.persisted().catch(function () { return false; });
    return Promise.resolve(false);
  };
  DB.estimate = function () {
    if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate().catch(function () { return null; });
    return Promise.resolve(null);
  };

  G.DB = DB;
})(window.GPI = window.GPI || {});
