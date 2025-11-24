import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import axios from 'axios';
import { Card, Heading, Flex, Button, Text, useColorModeValue, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, Box, useDisclosure, Spinner, Checkbox, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody, PopoverCloseButton, useToast, Switch } from "@chakra-ui/react";
import { DownloadIcon } from '@chakra-ui/icons';
import { useMsal } from "@azure/msal-react";
import { API_BASE } from '../../config/apiBase';

// --- ENV (React .env) ----------------------------------------------------------
// We use ONLY REACT_APP_* variables. (No Vite/import.meta here.)
const TENANT_ID       = process.env.REACT_APP_TENANT_ID       || 'single';
const API_SCOPE       = process.env.REACT_APP_API_SCOPE       || '';
const API_CLIENT_ID   = process.env.REACT_APP_API_CLIENT_ID   || '';
const DLT_CATEGORY_ID = process.env.REACT_APP_DLT_CATEGORY_ID || 'dlt';
const CAMP_ID_MAP_RAW = process.env.REACT_APP_CAMP_ID_MAP     || '';
const SEASON_START    = process.env.REACT_APP_DLT_SEASON_START || '2025-08-01T00:00:00Z';
const SEASON_END      = process.env.REACT_APP_DLT_SEASON_END   || '2026-08-01T23:59:59Z';
// Build MSAL scopes safely (avoid "api:///.default" when env is missing)
const buildScopes = () => {
  if (API_SCOPE && String(API_SCOPE).trim()) {
    return String(API_SCOPE)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  if (API_CLIENT_ID && String(API_CLIENT_ID).trim()) {
    return [`api://${API_CLIENT_ID}/.default`];
  }
  return [];
};
// ------------------------------------------------------------------------------

// --- Player id helpers (prefer child's email, then parent email, then legacy id) -----
const preferredPlayerId = (p = {}) => {
  const child = (p.spelarmejl || '').trim();
  const parent = (p.email || '').trim();
  const legacy = (p.id || '').trim();
  return child || parent || legacy;
};
const idCandidates = (p = {}) => {
  const uniq = new Set(
    [p.spelarmejl, p.email, p.legacyId, p.parentEmail, p.id]
      .map(x => (x || '').toString().trim())
      .filter(Boolean)
  );
  return Array.from(uniq);
};

// --- Local session cache helpers (JS) -----------------------------------------
const __CACHE_NS = 'hub-cache.v2';
const makeKey = (key, coachId, tenantId = 'single') => `${__CACHE_NS}::${tenantId}::${coachId || 'anon'}::${key}`;
const getCache = (fullKey) => {
  try {
    const raw = sessionStorage.getItem(fullKey);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== 'object') return null;
    const { ts, ttl, data } = entry;
    if (!ts || typeof ttl !== 'number') return null;
    if (Date.now() - ts > ttl) {
      sessionStorage.removeItem(fullKey);
      return null;
    }
    return data;
  } catch { return null; }
};
const setCache = (fullKey, data, ttlMs) => {
  try { sessionStorage.setItem(fullKey, JSON.stringify({ ts: Date.now(), ttl: ttlMs, data })); } catch {}
};

// ---- Helpers: fetch all WC orders + read meta --------------------------------
const fetchAllOrders = async (params = {}) => {
  const per_page = 100;
  let page = 1;
  let all = [];
  for (;;) {
    const { data } = await axios.get(`${API_BASE}/wc/orders`, {
      params: { ...params, per_page, page, status: params.status || 'completed,processing,on-hold' }
    });
    const batch = Array.isArray(data) ? data : [];
    all = all.concat(batch);
    if (batch.length < per_page) break;
    page += 1;
    if (page > 50) break; // safety
  }
  return all;
};
const getMeta = (meta = [], keys = []) => {
  const lc = keys.map(k => String(k).toLowerCase());
  for (const m of meta) {
    const key = String(m?.key || '').toLowerCase();
    if (lc.includes(key)) {
      const v = (m?.value ?? '').toString().trim();
      if (v) return v;
    }
  }
  return '';
};

// Read meta from order OR any of its line items
const getMetaDeep = (order, keys = []) => {
  const vOrder = getMeta(order?.meta_data, keys);
  if (vOrder) return vOrder;
  const items = Array.isArray(order?.line_items) ? order.line_items : [];
  for (const li of items) {
    const vItem = getMeta(li?.meta_data, keys);
    if (vItem) return vItem;
  }
  return '';
};

// ------------------------------------------------------------------------------

// Normalize phone to only digits
const normalizePhone = (s) => String(s || '').replace(/\D+/g, '');

// Jersey number must be an integer 1..999
const sanitizeJersey = (v) => {
  const n = Number(String(v || '').replace(/\D+/g, ''));
  if (!Number.isFinite(n)) return '';
  if (n < 1) return 1;
  if (n > 999) return 999;
  return n;
};

ModuleRegistry.registerModules([AllCommunityModule]);

const camps = ['Läger 1', 'Läger 2', 'Läger 3', 'Läger 4', 'Läger 5'];
const categories = ['bollkontroll', 'forsvar', 'anfall', 'kommunikation', 'sociala', 'styrka', 'spelforstaelse'];

const categoryTitles = ['Bollkontroll', 'Försvar', 'Anfall', 'Kommunikation', 'Sociala egenskaper', 'Styrka/Kondition', 'Spelförståelse'];
// Kolumnhanterare: vilka topp-kolumner som kan döljas/visas via UI
const TOGGLABLE_COLUMNS = [
  { id: 'fav', label: 'Favorit' },
  { id: 'spelarnamn', label: 'Spelarnamn' },
  { id: 'jersey_number', label: 'Tröjnummer' },
  { id: 'kon', label: 'Kön' },
  { id: 'alderspelare', label: 'Ålderspelare' },
  { id: 'klubblag', label: 'Klubblag' },
  { id: 'basket_position', label: 'Basket Position' },
  { id: 'aktuellserie', label: 'Aktuell Serie' },
  { id: 'mobilnummer', label: 'Mobilnummer' },
  { id: 'spelarmejl', label: 'Spelarmejl' },
  { id: 'tshirt_storlek', label: 'T-Shirt storlek' },
  { id: 'parent_name', label: 'Föräldrar namn' },
  { id: 'parent_email', label: 'Föräldrar Email' },
  { id: 'parent_phone', label: 'Föräldrar Telefon' },
  { id: 'parent_address', label: 'Föräldrar Adress' }
];

// eslint-disable-next-line no-unused-vars
const campProducts = { // används av Azure-registrering (paritet i frontend även om listvyn inte nyttjar den direkt)
  0: 18801, // Läger 1
  1: 18867, // Läger 2
  2: 18868, // Läger 3
  3: 0,     // Läger 4
  4: 0      // Läger 5
};


const PlayerList = () => {
  const [rowData, setRowData] = useState([]);
  const textColor = useColorModeValue("navy.700", "white");
  const { instance, accounts } = useMsal();
  const currentUser = accounts[0] ? accounts[0].name : 'Unknown';
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [favorites, setFavorites] = useState(new Set());
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  // keep track of favorites currently being saved to avoid double-click confusion
  const [pendingFavIds, setPendingFavIds] = useState(new Set());
  const gridRef = useRef();
  const [isLoading, setIsLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  const toast = useToast();

  // Controlled popover for columns
  const colPicker = useDisclosure();

  // Persistenta kolumnval per coach
  const coachId = accounts?.[0]?.username || accounts?.[0]?.localAccountId || 'local-dev';
  if (typeof window !== 'undefined') window.__coachId = coachId;
  const tenantId = TENANT_ID;
  const COL_KEY = `playerlist.columns.v1::${coachId}`;
  const CACHE_KEY = makeKey('playerlist', coachId, tenantId);
  const [colVisibility, setColVisibility] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COL_KEY) || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch (_) {}
    // default: visa endast Favorit → Aktuell Serie (+ Tröjnummer)
    const allOn = {};
    TOGGLABLE_COLUMNS.forEach(c => { allOn[c.id] = false; });
    ['fav','spelarnamn','jersey_number','kon','alderspelare','klubblag','basket_position','aktuellserie']
      .forEach(id => { allOn[id] = true; });
    return allOn;
  });

  const applyVisibilityToGrid = useCallback(() => {
    const colApi = gridRef.current?.columnApi;
    if (!colApi) return;
    const state = Object.entries(colVisibility).map(([colId, visible]) => ({ colId, hide: !visible }));
    colApi.applyColumnState({ state, applyOrder: false });
  }, [colVisibility]);


  // ---- Load players + favorites -------------------------------------------------
  const fetchPlayers = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadedCount(0);
      // Session-cache via utility (per coach + tenant)
      const cached = getCache(CACHE_KEY);
      if (cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
        setRowData(cached.rows);
        setIsLoading(false);
        return; // snabb återkomst
      }
      // Backend ger redan ihopslagna spelare (Woo + Cosmos ratings)
      // Hämta alla sidor om backend paginerar (per_page=100)
      let page = 1;
      const per_page = 250;
      let players = [];
      for (;;) {
        const { data } = await axios.get(`${API_BASE}/district/players`, {
          params: { page, per_page }
        });
        const batch =
          (data && Array.isArray(data.players)) ? data.players :
          (Array.isArray(data) ? data : []);
        players = players.concat(batch);
        setLoadedCount(players.length);
        if (!batch || batch.length < per_page) break;
        console.log('[PlayerList] fetched batch', { page, batchLen: batch.length, totalSoFar: players.length });
        page += 1;
        if (page > 50) break; // safety guard
      }

      // --- Enrich missing T-shirt sizes from Woo orders (no dedupe changes) ---
      try {
        const needsTshirt = (players || []).some(p => !p.tshirt_storlek && !p.tshirt && !p.tshirtSize);
        if (needsTshirt) {
          const seasonStart = new Date(SEASON_START);
          const seasonEnd   = new Date(SEASON_END);

          // Pull all orders in season
          const orders = await fetchAllOrders({
            status: 'completed,processing,on-hold',
            after: seasonStart.toISOString(),
            before: seasonEnd.toISOString()
          });

          // Helpers
          const flattenAttrs = (items) => (items || []).flatMap(li => Array.isArray(li.attributes) ? li.attributes : []);
          const findTshirtAttr = (attrs) => {
            for (const a of attrs) {
              const name = String(a?.name || '').toLowerCase();
              if (/t.?shirt|storlek|size/.test(name)) return (a?.option || '').toString().trim();
            }
            return '';
          };
          const getPlayerEmail = (o) => getMetaDeep(o, ['dlt_spelarmejl','dlt_email','spelarmejl','player_email','spelare_email','spelarens_email','spelarens_mejl']).toLowerCase();
          const getPlayerPhone = (o) => normalizePhone(getMetaDeep(o, ['dlt_mobilnummer','mobilnummer','telefon','phone']) || o?.billing?.phone);

          // Build lookup maps by email and phone
          const emailToSize = new Map();
          const phoneToSize = new Map();
          for (const o of orders) {
            const size = getMetaDeep(o, ['dlt_tshirt','dlt_tshirtstorlek','tshirt','t-shirt','t_shirt','storlek','tshirtstorlek']) || findTshirtAttr(flattenAttrs(o.line_items));
            if (!size) continue;
            const em = getPlayerEmail(o);
            const ph = getPlayerPhone(o);
            if (em) emailToSize.set(em, size);
            if (ph) phoneToSize.set(ph, size);
          }

          // Enrich players in-place
          players = players.map(p => {
            if (p.tshirt_storlek || p.tshirt || p.tshirtSize) return p;
            const em = (p.spelarmejl || p.playerEmail || '').toLowerCase();
            const ph = normalizePhone(p.mobilnummer || p.phone);
            const size = (em && emailToSize.get(em)) || (ph && phoneToSize.get(ph)) || '';
            return size ? { ...p, tshirt_storlek: size } : p;
          });
        }
      } catch (e) {
        console.warn('[PlayerList] T-shirt enrichment skipped:', e?.message || e);
      }

      // --- Enrich registeredCamps from Woo (using ENV mapping, OR med befintliga) ---
      try {
        const seasonStart = new Date(SEASON_START);
        const seasonEnd   = new Date(SEASON_END);

        const orders = await fetchAllOrders({
          status: 'completed,processing,on-hold',
          after: seasonStart.toISOString(),
          before: seasonEnd.toISOString()
        });

        const campMap = (CAMP_ID_MAP_RAW || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .reduce((m, pair) => {
            const [id, idx] = pair.split(':');
            const pid = Number(id);
            const pidx = Number(idx);
            if (Number.isInteger(pid) && Number.isInteger(pidx)) m[pid] = pidx;
            return m;
          }, {});

        const flagsFromLineItems = (items = []) => {
          const flags = [false, false, false, false, false];
          for (const li of (items || [])) {
            const idsToCheck = [Number(li?.variation_id), Number(li?.product_id)];
            idsToCheck.forEach(id => {
              const idx = campMap[id];
              if (Number.isInteger(idx) && idx >= 0 && idx < 5) {
                flags[idx] = true;
              }
            });
          }
          return flags;
        };

        const getPlayerEmail = (o) => getMetaDeep(o, ['dlt_spelarmejl','dlt_email','spelarmejl','player_email','spelare_email','spelarens_email','spelarens_mejl']).toLowerCase();
        const getPlayerPhone = (o) => normalizePhone(getMetaDeep(o, ['dlt_mobilnummer','mobilnummer','telefon','phone']) || o?.billing?.phone);

        // Bygg upp kartor med OR över alla ordrar för varje spelare (e-post/telefon)
        const emailToFlags = new Map();
        const phoneToFlags = new Map();
        for (const o of orders) {
          const flags = flagsFromLineItems(o.line_items);
          if (!flags.some(Boolean)) continue;
          const em = getPlayerEmail(o);
          const ph = getPlayerPhone(o);
          if (em) {
            const prev = emailToFlags.get(em) || [false,false,false,false,false];
            emailToFlags.set(em, prev.map((v,i) => v || flags[i]));
          }
          if (ph) {
            const prev = phoneToFlags.get(ph) || [false,false,false,false,false];
            phoneToFlags.set(ph, prev.map((v,i) => v || flags[i]));
          }
        }

        players = players.map(p => {
          const em = (p.spelarmejl || p.playerEmail || '').toLowerCase();
          const ph = normalizePhone(p.mobilnummer || p.phone);
          const byEmail = em && emailToFlags.get(em);
          const byPhone = ph && phoneToFlags.get(ph);
          const flags = byEmail || byPhone || null;
          if (!flags) return p;

          const existing = Array.isArray(p.registeredCamps) ? p.registeredCamps : [false,false,false,false,false];
          const merged = [0,1,2,3,4].map(i => !!((existing[i] || false) || (flags[i] || false)));

          return { ...p, registeredCamps: merged };
        });
      } catch (e) {
        console.warn('[PlayerList] registeredCamps enrichment skipped:', e?.message || e);
      }


      // Fallback/komplettering (AVSTÄNGD som standard):
      // Kör alltid om färre än 130 spelare är laddade.
      if (players.length < 130) {
        console.warn('[PlayerList] Fallback aktiverad: endast', players.length, 'spelare från /district/players. Kompletterar via Woo orders...');
        try {
          // Säsong (Aug 1 -> Aug 1)
          const seasonStart = new Date(SEASON_START);
          const seasonEnd   = new Date(SEASON_END);

          // Slå upp DLT-kategori-ID från slug 'dlt' eller env
          const resolveIdFromSlug = async (slug) => {
            if (!slug) return null;
            if (!isNaN(Number(slug))) return Number(slug);
            const r = await axios.get(`${API_BASE}/wc/products/categories`, { params: { slug: String(slug).trim() } });
            const match = Array.isArray(r.data) ? r.data.find(x => x.slug === String(slug).trim()) : null;
            return match ? Number(match.id) : null;
          };
          const dltCategoryId = await resolveIdFromSlug(DLT_CATEGORY_ID);

          // Hämta alla ordrar för säsongen (completed,processing,on-hold)
          const orders = await fetchAllOrders({
            status: 'completed,processing,on-hold',
            after: seasonStart.toISOString(),
            before: seasonEnd.toISOString()
          });

          // Hämta DLT-produkter och filtrera ordrar till rader i DLT-kategorin
          let dltProductIds = [];
          if (dltCategoryId) {
            const prodRes = await axios.get(`${API_BASE}/wc/products`, {
              params: { per_page: 100, category: dltCategoryId }
            });
            dltProductIds = (prodRes.data || []).map(p => p.id);
          }
          const ordersDLT = orders.map(o => {
            const dltItems = (o.line_items || []).filter(li => dltProductIds.includes(li.product_id));
            return { ...o, line_items: dltItems };
          }).filter(o => (o.line_items || []).length > 0);

          // Bygg spelarobjekt – BARNETS namn & data från meta, inte föräldrarnas billing
          const derivedPlayers = [];
          // Helpers to flatten and extract T-shirt size from attributes
          const flattenAttrs = (items) => (items || []).flatMap(li => Array.isArray(li.attributes) ? li.attributes : []);
          const findTshirtAttr = (attrs) => {
            for (const a of attrs) {
              const name = String(a?.name || '').toLowerCase();
              if (/t.?shirt|storlek|size/.test(name)) return (a?.option || '').toString().trim();
            }
            return '';
          };

          // Map product/variation -> camp index from ENV (e.g. "18611:0,19008:0,19009:0")
          const campMap = (CAMP_ID_MAP_RAW || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .reduce((m, pair) => {
              const [id, idx] = pair.split(':');
              const pid = Number(id);
              const pidx = Number(idx);
              if (Number.isInteger(pid) && Number.isInteger(pidx)) m[pid] = pidx;
              return m;
            }, {});

          const flagsFromLineItems = (items = []) => {
            const flags = [false, false, false, false, false];
            for (const li of (items || [])) {
              const idsToCheck = [Number(li?.variation_id), Number(li?.product_id)];
              idsToCheck.forEach(id => {
                const idx = campMap[id];
                if (Number.isInteger(idx) && idx >= 0 && idx < 5) {
                  flags[idx] = true;
                }
              });
            }
            return flags;
          };

          // Optional: infer gender from variation name if meta is missing
          const inferGenderFromName = (name = '') => {
            const n = String(name).toLowerCase();
            if (/pojke|herr|boy|male/.test(n)) return 'Man/Pojke';
            if (/flicka|dam|girl|female/.test(n)) return 'Kvinna/Flicka';
            return '';
          };

          ordersDLT.forEach(o => {
            const childName = getMetaDeep(o, ['dlt_spelarnamn','spelarnamn','spelarens_namn','barnets_namn']) ||
                              `${o?.billing?.first_name || ''} ${o?.billing?.last_name || ''}`.trim();
            const parentName = `${o?.billing?.first_name || ''} ${o?.billing?.last_name || ''}`.trim();
            const parentEmail = o?.billing?.email || '';
            const parentPhone = o?.billing?.phone || '';

            const playerEmail = getMetaDeep(o, [
              'dlt_spelarmejl',
              'dlt_email',
              'spelarmejl',
              'player_email',
              'spelare_email',
              'spelarens_email',
              'spelarens_mejl'
            ]);
            const konRaw = getMetaDeep(o, ['dlt_kon','kon','gender','kön','barnets_kön']) || '';
            const lineName = (o?.line_items && o.line_items[0] && o.line_items[0].name) ? o.line_items[0].name : '';
            let kon = /kvinna|flicka|female|f/i.test(konRaw) ? 'Kvinna/Flicka' : (/man|pojke|male|m/i.test(konRaw) ? 'Man/Pojke' : '');
            if (!kon) kon = inferGenderFromName(lineName);
            const alderspelare = getMetaDeep(o, ['dlt_alderspelare','fodelsear','födelseår','birthyear']) || '';
            const klubblag = getMetaDeep(o, ['dlt_klubblag','klubblag','klubb']) || '';
            const basket_position = getMetaDeep(o, ['dlt_basket_position','basket_position','position']) || '';
            const aktuellserie = getMetaDeep(o, ['dlt_aktuellserie','aktuellserie','serie']) || '';
            const mobilnummer = getMetaDeep(o, ['dlt_mobilnummer','mobilnummer','telefon','phone']) || parentPhone;
            const spelarmejl = playerEmail || '';
            const tshirt_storlek =
              getMetaDeep(o, ['dlt_tshirt','dlt_tshirtstorlek','tshirt','t-shirt','t_shirt','storlek','tshirtstorlek'])
              || findTshirtAttr(flattenAttrs(o.line_items))
              || '';

            derivedPlayers.push({
              id: `o_${o.id}`,
              spelarnamn: childName,
              kon,
              alderspelare,
              klubblag,
              basket_position,
              aktuellserie,
              mobilnummer,
              spelarmejl,
              tshirt_storlek,
              // Föräldra-fält till egna kolumner (backend-format)
              name: parentName,
              email: parentEmail,
              phone: parentPhone,
              attributes: flattenAttrs(o.line_items),
              registeredCamps: flagsFromLineItems(o.line_items),
              ratings: [{},{},{},{},{}],
              comments: [
                { value:'', by:'', timestamp:'' },
                { value:'', by:'', timestamp:'' },
                { value:'', by:'', timestamp:'' },
                { value:'', by:'', timestamp:'' },
                { value:'', by:'', timestamp:'' }
              ],
              campAverages: [0,0,0,0,0],
              isFavorite: false,
              source: 'woo'
            });
            setLoadedCount(players.length + derivedPlayers.length);
          });

          console.log('[PlayerList] woo-derived count:', derivedPlayers.length);

          // DEDUPE: prioritet på /district/players; matcha i första hand på spelarmejl
          const keyOf = (p) => {
            const email = (p.spelarmejl || '').toLowerCase();
            if (email) return `e:${email}`;
            return `n:${(p.spelarnamn||'').toLowerCase()}|y:${p.alderspelare||''}|c:${(p.klubblag||'').toLowerCase()}`;
          };
          const map = new Map();
          (players || []).forEach(p => map.set(keyOf(p), p));
          derivedPlayers.forEach(p => {
            const k = keyOf(p);
            if (!map.has(k)) map.set(k, p);
          });
          players = Array.from(map.values());
        } catch (e) {
          console.warn('Fallback via Woo-orders misslyckades (ignoreras):', e?.message || e);
        }
      }

      // Tagga källa för dedupe (backend)
      players = players.map(p => ({ ...p, source: p.source || 'backend' }));

      // Hämta coachens favoriter
      let favSet = new Set();
      try {
        const scopes = buildScopes();
        let headers = {};
        try {
          if (scopes.length > 0) {
            const tokenResp = await instance.acquireTokenSilent({ scopes, account: accounts[0] });
            if (tokenResp?.accessToken) headers.Authorization = `Bearer ${tokenResp.accessToken}`;
          }
        } catch (_) { /* dev utan token */ }
        headers['x-dev-coachid'] = accounts?.[0]?.username || accounts?.[0]?.localAccountId || 'local-dev';
        headers['x-tenant-id'] = TENANT_ID;

        const res = await fetch(`${API_BASE}/district/favorites`, { headers });
        const favIds = await res.json();
        favSet = new Set(Array.isArray(favIds) ? favIds : []);
        setFavorites(favSet);
      } catch (e) {
        console.error('Error loading favorites:', e);
      }

      // Normalisera rader så index-åtkomst aldrig spricker och fyll i saknade fält från meta/alternativa namn
      const normalize = (p) => {
        const regs = Array.isArray(p.registeredCamps) && p.registeredCamps.length === 5 ? p.registeredCamps : [false,false,false,false,false];
        const ratings = Array.isArray(p.ratings) && p.ratings.length === 5 ? p.ratings : [{},{},{},{},{}];
        const comments = Array.isArray(p.comments) && p.comments.length === 5
          ? p.comments
          : [ {}, {}, {}, {}, {} ].map(() => ({ value:'', by:'', timestamp:'' }));
        const campAverages = Array.isArray(p.campAverages) && p.campAverages.length === 5 ? p.campAverages : [0,0,0,0,0];

        // Helpers to extract meta/fallbacks
        const getMetaLocal = (meta = [], keys = []) => {
          const lc = keys.map(k => String(k).toLowerCase());
          for (const m of meta) {
            const key = String(m?.key || '').toLowerCase();
            if (lc.includes(key)) {
              const v = (m?.value ?? '').toString().trim();
              if (v) return v;
            }
          }
          return '';
        };
        const pick = (...vals) => {
          for (const v of vals) {
            if (v !== undefined && v !== null) {
              const s = String(v).trim();
              if (s) return s;
            }
          }
          return '';
        };

        // Derivations / fallbacks
        const spelarmejl = pick(
          p.spelarmejl,
          p.playerEmail,
          getMetaLocal(p.meta, [
            'dlt_spelarmejl',
            'dlt_email',
            'spelarmejl',
            'player_email',
            'spelare_email',
            'spelarens_email',
            'spelarens_mejl'
          ])
        );
        const mobilnummer = pick(p.mobilnummer, p.phone, p.mobil, p.telefon);
        const tshirt = pick(
          p.tshirt_storlek,
          p.tshirt,
          p['t-shirt'],
          p.tshirtSize,
          getMetaLocal(
            p.meta,
            [
              'dlt_tshirt',
              'dlt_tshirtstorlek',
              'tshirt',
              't-shirt',
              't_shirt',
              'tshirtstorlek',
              'storlek t-shirt',
              'storlek_tshirt',
              'shirt_size',
              'size',
              'storlek'
            ]
          ),
          (Array.isArray(p.attributes)
            ? (p.attributes.find(a => /t.?shirt|storlek/i.test(String(a?.name)))?.option || '')
            : '')
        );

        // --- Stable id for favorites & Cosmos ---
        const safeSlug = (s = '') => String(s).toLowerCase().trim()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        const emailKeyLower = (spelarmejl || '').toLowerCase();
        const phoneKey = normalizePhone(mobilnummer || '');
        // Bygg alltid ett id där spelarens mejl prioriteras, sedan telefon, sedan namnbaserad fallback
        const computedId = emailKeyLower
          || (phoneKey ? `p_${phoneKey}` : `k_${(p.alderspelare||'')}_${safeSlug(p.spelarnamn)}_${safeSlug(p.klubblag)}_${safeSlug(p.aktuellserie)}`);

        // Spara även gamla nycklar så favoriter och äldre poster fortfarande kan kännas igen
        const parentEmailLower = (p.email || '').toLowerCase();
        const legacyId = p.id || '';
        const finalId = computedId || (legacyId ? String(legacyId).toLowerCase() : '');

        // Jersey number normalization
        const jerseyNumber = (() => {
          const direct = p.jerseyNumber;
          if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
            return sanitizeJersey(direct);
          }
          const metaNum = getMetaLocal(p.meta, [
            'jersey','jersey_number','jerseynumber','tröjnummer','trojnummer','trönummer','shirt_number','trikotnummer'
          ]);
          if (metaNum) return sanitizeJersey(metaNum);
          return '';
        })();

        return {
          id: finalId,             // alltid spelarens mejl om vi har den
          legacyId,                // gamla id:t (t.ex. o_19146 eller förälders mejl)
          parentEmail: parentEmailLower,
          jerseyNumber,
          ...p,
          registeredCamps: regs,
          ratings,
          comments,
          campAverages,
          spelarmejl,
          mobilnummer,
          tshirt_storlek: tshirt
        };
      };
      const playersWithFav = (players || []).map((p) => {
        const n = normalize(p);
        const fav =
            favSet.has(n.id) ||
            (n.spelarmejl && favSet.has(String(n.spelarmejl).toLowerCase())) ||
            (n.legacyId && favSet.has(n.legacyId)) ||
            (n.parentEmail && favSet.has(n.parentEmail));
        return { ...n, isFavorite: fav };
      });
      console.log('[PlayerList] total players loaded:', playersWithFav.length);
      // Dedupe per spelare: robust gruppnyckel (email, annars phone, annars year, annars name)
      const richness = (p) => [p.spelarmejl,p.mobilnummer,p.tshirt_storlek,p.klubblag,p.basket_position,p.aktuellserie].filter(x => x && String(x).trim()).length;
      const groups = new Map();
      for (const p of playersWithFav) {
        const emailKey = (p.spelarmejl || '').toString().trim().toLowerCase();
        const phoneKey = String(p.mobilnummer || '').replace(/\D+/g, '');
        const yearKey  = String(p.alderspelare || '').trim();
        const nameKey  = (p.spelarnamn || '').toString().trim().toLowerCase();
        const clubKey  = (p.klubblag || '').toString().trim().toLowerCase();
        const serieKey = (p.aktuellserie || '').toString().trim().toLowerCase();

        let key;
        if (emailKey) {
          key = `e:${emailKey}`; // 1) unikt på spelarens e-post
        } else if (phoneKey) {
          key = `p:${phoneKey}`; // 2) annars telefon (normaliserad)
        } else if (yearKey) {
          key = `y:${yearKey}|n:${nameKey}|k:${clubKey}|s:${serieKey}`; // 3) år + namn + klubb + serie
        } else {
          key = `n:${nameKey}|k:${clubKey}|s:${serieKey}`; // 4) namn + klubb + serie
        }

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
      }
      const deduped = [];
      for (const [, arr] of groups.entries()) {
        // välj bästa kandidat i gruppen
        let best = arr[0];
        // Debug: warn if we merged players without reliable email/phone keys
        if (arr.length > 1) {
          const hasReliable = arr.some(x => (x.spelarmejl && x.spelarmejl !== x.email) || String(x.mobilnummer||'').replace(/\D+/g,'').length > 0);
          if (!hasReliable) {
            console.warn('[PlayerList] Possible soft-duplicate group merged (no email/phone). Candidates:', arr.map(a => ({ namn:a.spelarnamn, ar:a.alderspelare, klubb:a.klubblag, serie:a.aktuellserie })));
          }
        }
        const hasPlayerEmail = (x) => !!(x.spelarmejl && x.spelarmejl !== x.email);
        const hasPhone = (x) => !!normalizePhone(x.mobilnummer);
        for (const x of arr) {
          const byEmail = Number(hasPlayerEmail(x)) - Number(hasPlayerEmail(best));
          const byPhone = Number(hasPhone(x)) - Number(hasPhone(best));
          const byRich = richness(x) - richness(best);
          const bySource = (best.source === 'backend' ? 0 : -1) - (x.source === 'backend' ? 0 : -1); // prefer backend on tie
          if (
            byEmail > 0 ||
            (byEmail === 0 && (
              byPhone > 0 ||
              (byPhone === 0 && (byRich > 0 || (byRich === 0 && bySource < 0)))
            ))
          ) {
            best = x;
          }
        }
        deduped.push(best);
      }
      console.log('[PlayerList] deduped count:', { before: playersWithFav.length, after: deduped.length });

      // ---- Hydrate favorites with latest ratings/comments from Cosmos ----------
      let merged = deduped;
      try {
        // Build auth headers once
        const scopes = buildScopes();
        let headers = {};
        try {
          if (scopes.length > 0) {
            const tokenResp = await instance.acquireTokenSilent({ scopes, account: accounts[0] });
            if (tokenResp?.accessToken) headers.Authorization = `Bearer ${tokenResp.accessToken}`;
          }
        } catch (_) { /* dev utan token */ }
        headers['x-dev-coachid'] = accounts?.[0]?.username || accounts?.[0]?.localAccountId || 'local-dev';
        headers['x-tenant-id'] = TENANT_ID;

        const idsToHydrate = deduped
          .map(p => preferredPlayerId(p))
          .filter(Boolean);

        if (idsToHydrate.length) {
          const map = new Map();
          await Promise.all(
            idsToHydrate.map(async (pid) => {
              try {
                const r = await fetch(`${API_BASE}/district/players/${encodeURIComponent(pid)}/ratings`, { headers });
                if (r.ok) {
                  const j = await r.json();
                  map.set(pid, j);
                }
              } catch (_) { /* ignore network errors */ }
            })
          );

          if (map.size) {
            merged = deduped.map(p => {
              const pid = preferredPlayerId(p);
              const doc = pid && map.get(pid);
              if (doc && (doc.ratings || doc.comments)) {
                return {
                  ...p,
                  ratings: Array.isArray(doc.ratings) ? doc.ratings : p.ratings,
                  comments: Array.isArray(doc.comments) ? doc.comments : p.comments,
                  jerseyNumber: (doc.jerseyNumber !== undefined ? doc.jerseyNumber : p.jerseyNumber),
                  id: doc.id || p.id
                };
              }
              return p;
            });
          }
        }
      } catch (e) {
        console.warn('[PlayerList] hydration skipped:', e?.message || e);
      }

      setCache(CACHE_KEY, { rows: merged }, 10 * 60 * 1000); // 10 min TTL
      setRowData(merged);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching players:', error.response ? error.response.data : error.message);
      setIsLoading(false);
    }
  }, [instance, accounts, CACHE_KEY]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    const t = setTimeout(() => applyVisibilityToGrid(), 0);
    return () => clearTimeout(t);
  }, [applyVisibilityToGrid]);
  const onFirstDataRendered = useCallback(() => {
    // Säkerställ att state appliceras när kolumner och data är redo
    applyVisibilityToGrid();
  }, [applyVisibilityToGrid]);

  // ---- Favorit-cache sync helper ------------------------------------------------
  const updateCacheAfterFavorite = useCallback((playerId, isFav) => {
  try {
    const cached = getCache(CACHE_KEY);
    if (cached && Array.isArray(cached.rows)) {
      const rows = cached.rows.map(r => {
        const rid = preferredPlayerId(r) || r.id;
        return (r.id === playerId || rid === playerId)
          ? { ...r, isFavorite: isFav }
          : r;
      });
      setCache(CACHE_KEY, { rows }, 10 * 60 * 1000);
    }
  } catch (_) {}
}, [CACHE_KEY]);

  // ---- Favorit-toggle -----------------------------------------------------------
  const toggleFavorite = useCallback(async (player) => {
    const scopes = buildScopes();

    // Use a stable player-centric id for persistence, prefer child email
    const effectiveId = preferredPlayerId(player) || player.id;
    const candidates = idCandidates(player);

    // prevent spamming the same row while request is in flight
    setPendingFavIds(prev => new Set(prev).add(player.id));

    // compute current value from the row (source of truth) to avoid stale Set
    const currentlyFav = !!player.isFavorite;

    // Diagnostics for debugging
    console.debug('[favorites] toggle ->', { effectiveId, rowId: player.id, currentlyFav });

    // build headers (MSAL token if available)
    let headers = { 'Content-Type': 'application/json' };
    try {
      if (scopes.length > 0) {
        const tokenResp = await instance.acquireTokenSilent({ scopes, account: accounts[0] });
        if (tokenResp?.accessToken) headers.Authorization = `Bearer ${tokenResp.accessToken}`;
      }
    } catch (_) { /* dev without token */ }
    headers['x-dev-coachid'] = accounts?.[0]?.username || accounts?.[0]?.localAccountId || 'local-dev';
    headers['x-tenant-id'] = TENANT_ID;

    // --- Optimistic UI update: flip local state immediately ---
    setRowData(prev => prev.map(r => r.id === player.id ? { ...r, isFavorite: !currentlyFav } : r));
    // keep session cache in sync
    updateCacheAfterFavorite(player.id, !currentlyFav);
    try {
      const api = gridRef.current?.api;
      const node = api?.getRowNode(player.id);
      if (node) {
        node.setData({ ...node.data, isFavorite: !currentlyFav });
        api.refreshCells({ force: true, columns: ['fav'], rowNodes: [node] });
        if (showOnlyFavorites) api.refreshClientSideRowModel('filter');
      } else {
        gridRef.current?.api?.refreshCells({ force: true, columns: ['fav'] });
      }
    } catch (_) {}

    // also update the Set used by filters/buttons
            setFavorites(prev => {
        const next = new Set(prev);
        const keys = new Set([player.id, effectiveId, (player.spelarmejl || '').toLowerCase()]);
        if (currentlyFav) {
          keys.forEach(k => k && next.delete(k));
        } else {
          keys.forEach(k => k && next.add(k));
        }
        return next;
      });

    // --- Persist to backend ---
    let finalOk = false;
    try {
      const payload = { playerId: effectiveId, favorite: !currentlyFav, idCandidates: candidates };
      let res = await fetch(`${API_BASE}/district/favorites/toggle`, { method: 'POST', headers, body: JSON.stringify(payload) });

      if (!res.ok) {
        if (currentlyFav) {
          // explicit remove fallbacks
          res = await fetch(`${API_BASE}/district/favorites/remove`, { method: 'POST', headers, body: JSON.stringify({ playerId: effectiveId }) });
          if (!res.ok) {
            const url = `${API_BASE}/district/favorites?playerId=${encodeURIComponent(effectiveId)}`;
            res = await fetch(url, { method: 'DELETE', headers });
          }
        } else {
          // legacy add endpoint
          res = await fetch(`${API_BASE}/district/favorites`, { method: 'POST', headers, body: JSON.stringify({ playerId: effectiveId }) });
        }
      }

      if (res.ok) {
        finalOk = true;
        // try to respect server response if it returns the new value
        try {
          const json = await res.json();
          const newVal = typeof json?.favorite === 'boolean' ? json.favorite : !currentlyFav;
          setRowData(prev => prev.map(r => r.id === player.id ? { ...r, isFavorite: newVal } : r));
          updateCacheAfterFavorite(player.id, newVal);
          const api = gridRef.current?.api;
          const node = api?.getRowNode(player.id);
          if (node) {
            node.setData({ ...node.data, isFavorite: newVal });
            api.refreshCells({ force: true, columns: ['fav'], rowNodes: [node] });
            if (showOnlyFavorites) api.refreshClientSideRowModel('filter');
          }
          setFavorites(prev => {
            const s = new Set(prev);
            const keys = new Set([player.id, effectiveId, (player.spelarmejl || '').toLowerCase()]);
            if (newVal) {
              keys.forEach(k => k && s.add(k));
            } else {
              keys.forEach(k => k && s.delete(k));
            }
            return s;
          });
        } catch (_) { /* server returned no JSON */ }
      }
    } catch (e) {
      console.error('Toggle favorite failed:', e);
    } finally {
      setPendingFavIds(prev => { const n = new Set(prev); n.delete(player.id); return n; });
    }

    // --- Revert on failure ---
    if (!finalOk) {
      setRowData(prev => prev.map(r => r.id === player.id ? { ...r, isFavorite: currentlyFav } : r));
      updateCacheAfterFavorite(player.id, currentlyFav);
      setFavorites(prev => {
        const s = new Set(prev);
        const keys = new Set([player.id, effectiveId, (player.spelarmejl || '').toLowerCase()]);
        if (currentlyFav) {
          keys.forEach(k => k && s.add(k));
        } else {
          keys.forEach(k => k && s.delete(k));
        }
        return s;
      });
      try {
        const api = gridRef.current?.api;
        const node = api?.getRowNode(player.id);
        if (node) {
          node.setData({ ...node.data, isFavorite: currentlyFav });
          api.refreshCells({ force: true, columns: ['fav'], rowNodes: [node] });
          if (showOnlyFavorites) api.refreshClientSideRowModel('filter');
        }
      } catch (_) {}
    }
  }, [instance, accounts, showOnlyFavorites, updateCacheAfterFavorite]);

  // ---- Spara rating/kommentar --------------------------------------------------
  const savePlayerData = useCallback(async (playerId, data) => {
    // Helpers to sanitize payload to exactly 5 camps and plain JSON-safe values
    const ensureLen5 = (arr, fillerFactory) => {
      const out = Array.isArray(arr) ? arr.slice(0, 5) : [];
      while (out.length < 5) out.push(fillerFactory());
      return out;
    };
    const cleanRating = (r = {}) => {
      const o = {};
      // only allow known keys with A-F
      const grade = (v) => {
        const s = String(v || '').trim().toUpperCase();
        return ['A', 'B', 'C', 'D', 'E', 'F'].includes(s) ? s : undefined;
      };
      o.bollkontroll   = grade(r.bollkontroll)   || undefined;
      o.forsvar        = grade(r.forsvar)        || undefined;
      o.anfall         = grade(r.anfall)         || undefined;
      o.kommunikation  = grade(r.kommunikation)  || undefined;
      o.sociala        = grade(r.sociala)        || undefined;
      o.styrka         = grade(r.styrka)         || undefined;
      o.spelforstaelse = grade(r.spelforstaelse) || undefined;
      if (r.by) o.by = String(r.by);
      if (r.timestamp) o.timestamp = String(r.timestamp);
      // strip undefined keys
      Object.keys(o).forEach(k => o[k] === undefined && delete o[k]);
      return o;
    };
    const cleanComment = (c = {}) => ({
      value: String(c.value || ''),
      by: String(c.by || ''),
      timestamp: String(c.timestamp || '')
    });

    const ratings5  = ensureLen5(data?.ratings,  () => ({})).map(cleanRating);
    const comments5 = ensureLen5(data?.comments, () => ({ value:'', by:'', timestamp:'' })).map(cleanComment);

    // Single-value field persisted for all coaches
    const jerseyNumber = (data && data.jerseyNumber !== undefined)
      ? sanitizeJersey(data.jerseyNumber)
      : '';

    // Build a robust, player-centric id and fallbacks (legacy ids)
    const effectiveId = preferredPlayerId(data);
    const candidates  = idCandidates(data);

    const coachIdHdr = accounts?.[0]?.username || accounts?.[0]?.localAccountId || 'local-dev';

    const payload = {
      playerId: effectiveId,
      coachId: coachIdHdr,
      tenantId: TENANT_ID,
      ratings: ratings5,
      comments: comments5,
      jerseyNumber: jerseyNumber === '' ? undefined : jerseyNumber,
      idCandidates: candidates
    };
    // Logging request intent for diagnostics
    console.debug('[ratings] save ->', { effectiveId, candidates, hasRatings: !!ratings5, hasComments: !!comments5 });

    // headers (MSAL token if available)
    const scopes = buildScopes();
    let headers = { 'Content-Type': 'application/json' };
    try {
      if (scopes.length > 0) {
        const tokenResp = await instance.acquireTokenSilent({ scopes, account: accounts[0] });
        if (tokenResp?.accessToken) headers.Authorization = `Bearer ${tokenResp.accessToken}`;
      }
    } catch (_) {/* dev without token */}
    headers['x-dev-coachid'] = coachIdHdr;
    headers['x-tenant-id']   = TENANT_ID;
    headers['x-client']      = 'playerlist';

    const baseUrl = `${API_BASE}/district/players/${encodeURIComponent(effectiveId)}/ratings`;

    const tryPut = async () => fetch(baseUrl, { method: 'PUT', headers, body: JSON.stringify(payload) });

    let res = null;
    let resText = '';
    try {
      res = await tryPut();
      if (!res.ok && res.status === 404 && Array.isArray(candidates) && candidates.length) {
        // migrate once using the best legacy id (different from effectiveId)
        const legacy = candidates.find(x => (x || '').trim().toLowerCase() !== (effectiveId || '').trim().toLowerCase());
        if (legacy) {
          try {
            await fetch(`${API_BASE}/district/players/${encodeURIComponent(effectiveId)}/ratings/migrate`, {
              method: 'POST', headers, body: JSON.stringify({ legacyId: legacy })
            });
          } catch (_) {/* ignore migrate failure */}
          res = await tryPut();
        }
      }

      // If backend still responds 500, retry once with a strictly minimal sanitized payload
      if (!res.ok && res.status === 500) {
        const minimal = {
          ratings: ratings5,
          comments: comments5,
          idCandidates: candidates
        };
        res = await fetch(baseUrl, { method: 'PUT', headers, body: JSON.stringify(minimal) });
      }

      if (!res.ok) {
        try { resText = await res.text(); } catch (_) { /* ignore */ }
      }
    } catch (e) {
      console.error('Save ratings network error:', e);
    }

    if (!res || !res.ok) {
      console.error('❌ Save ratings failed', res?.status, resText || res);
      toast({
        title: 'Kunde inte spara betyg',
        description: resText ? `Server: ${resText}` : 'Kontrollera nätverk/behörighet – försök igen.',
        status: 'error',
        duration: 3500,
        isClosable: true,
        position: 'bottom-right'
      });
      return;
    }

    // If server returns the saved doc, sync local state + session cache
    try {
      const saved = await res.json();
      if (saved && (saved.ratings || saved.comments)) {
        // Update rows in memory
        setRowData(prev => prev.map(r => {
          const rid = preferredPlayerId(r);
          return rid === effectiveId ? {
            ...r,
            ratings: Array.isArray(saved.ratings) ? saved.ratings : r.ratings,
            comments: Array.isArray(saved.comments) ? saved.comments : r.comments,
            jerseyNumber: (saved.jerseyNumber !== undefined ? saved.jerseyNumber : r.jerseyNumber),
            id: saved.id || r.id
          } : r;
        }));

        // Update session cache
        const cached = getCache(CACHE_KEY);
        if (cached && Array.isArray(cached.rows)) {
          const rows = cached.rows.map(r => {
            const rid = preferredPlayerId(r);
            return rid === effectiveId ? {
              ...r,
              ratings: Array.isArray(saved.ratings) ? saved.ratings : r.ratings,
              comments: Array.isArray(saved.comments) ? saved.comments : r.comments,
              jerseyNumber: (saved.jerseyNumber !== undefined ? saved.jerseyNumber : r.jerseyNumber),
              id: saved.id || r.id
            } : r;
          });
          setCache(CACHE_KEY, { rows }, 10 * 60 * 1000);
        }
      }
    } catch (_) {
      // No JSON or parse error – ignore, state already updated in the grid
    }
  }, [instance, accounts, CACHE_KEY]);

  // ---- Grid handlers ------------------------------------------------------------
  const onCellValueChanged = useCallback(async (params) => {
    const campIndex = params.colDef.campIndex;
    const cat = params.colDef.cat;
    let needSave = false;

    if (cat) {
      if (!params.data.ratings) params.data.ratings = [{},{},{},{},{}];
      if (!params.data.ratings[campIndex]) params.data.ratings[campIndex] = {};
      if (params.oldValue !== params.newValue) {
        params.data.ratings[campIndex][cat] = params.newValue;
        params.data.ratings[campIndex].by = currentUser;
        params.data.ratings[campIndex].timestamp = new Date().toISOString();
        needSave = true;
        params.api.refreshCells({ columns: [`average_${campIndex}`], rowNodes: [params.node], force: true });
      }
    } else if (params.colDef.headerName === 'Kommentarer') {
      // Säkra comments-array + element
      if (!params.data.comments) {
        params.data.comments = [
          { value: '', by: '', timestamp: '' },
          { value: '', by: '', timestamp: '' },
          { value: '', by: '', timestamp: '' },
          { value: '', by: '', timestamp: '' },
          { value: '', by: '', timestamp: '' },
        ];
      }
      if (!params.data.comments[campIndex]) {
        params.data.comments[campIndex] = { value: '', by: '', timestamp: '' };
      }

      if (params.oldValue !== params.newValue) {
        params.data.comments[campIndex].value = params.newValue;
        params.data.comments[campIndex].by = currentUser;
        params.data.comments[campIndex].timestamp = new Date().toISOString();
        needSave = true;
      }
    } else if (params.colDef.colId === 'jersey_number') {
      const next = sanitizeJersey(params.newValue);
      const prev = sanitizeJersey(params.oldValue);
      if (next !== prev) {
        params.data.jerseyNumber = next;
        needSave = true;
      }
    }

    if (needSave) {
      const row = params.data;
      const item = {
        ...row,
        ratings: row.ratings,
        comments: row.comments,
        jerseyNumber: row.jerseyNumber
      };
      await savePlayerData(preferredPlayerId(row), item);
    }
  }, [currentUser, savePlayerData]);

  const getRowStyle = (params) => {
    if (params.data.kon === 'Kvinna/Flicka') {
      return { backgroundColor: '#ffebee' };
    } else if (params.data.kon === 'Man/Pojke') {
      return { backgroundColor: '#f5f5f5' };
    }
  };

  // ---- Betygs-helpers -----------------------------------------------------------
  const gradeToNumber = (grade) => {
    const map = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0 };
    return map[grade] || 0;
  };

  const calculateAverage = useCallback((rating) => {
    const values = categories.map(key => gradeToNumber(rating?.[key] || 'F'));
    const averageNum = (values.reduce((a, b) => a + b, 0) / categories.length);
    return ['A', 'B', 'C', 'D', 'E', 'F'][5 - Math.round(averageNum)];
  }, []);

  const ratingAverageRenderer = useCallback((params, campIndex) => {
    const rating = (params.data?.ratings && params.data.ratings[campIndex]) ? params.data.ratings[campIndex] : {};
    const averageGrade = calculateAverage(rating);
    const by = rating.by ? ` by ${rating.by}` : '';
    const ts = rating.timestamp ? ` at ${new Date(rating.timestamp).toLocaleString()}` : '';
    return averageGrade + ' (genomsnitt)' + by + ts;
  }, [calculateAverage]);

  const commentsRenderer = (params, campIndex) => {
    const comment = (params.data?.comments && params.data.comments[campIndex])
      ? params.data.comments[campIndex]
      : { value: '', by: '', timestamp: '' };
    const value = comment.value || '';
    const by = comment.by ? ` by ${comment.by}` : '';
    const ts = comment.timestamp ? ` at ${new Date(comment.timestamp).toLocaleString()}` : '';
    return value + by + ts;
  };

  const onGridReady = (params) => {
    gridRef.current.api = params.api;
    gridRef.current.columnApi = params.columnApi;
    // Använd sparat kolumnläge direkt
    applyVisibilityToGrid();
  };

  // ---- Favorite toggle cell (Switch) ------------------------------------------
  const FavoriteToggleCell = useCallback((props) => {
    const id = props.data?.id;
    const isFav = !!props.data?.isFavorite;
    const isBusy = pendingFavIds.has(id);

    const handleChange = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isBusy) toggleFavorite(props.data);
    };

    return (
      <Flex align="center" justify="center" h="100%">
        <Switch
          isChecked={isFav}
          onChange={handleChange}
          isDisabled={isBusy}
          size="lg"
          colorScheme="red"
          aria-label={isFav ? 'Ta bort som favorit' : 'Spara som favorit'}
        />
      </Flex>
    );
  }, [toggleFavorite, pendingFavIds]);

  // ---- Column defs --------------------------------------------------------------
  const columnDefs = useMemo(() => [
    {
      headerName: 'Favorit',
      colId: 'fav',
      width: 110,
      pinned: 'left',
      hide: !colVisibility['fav'],
      editable: false,
      suppressCellFocus: true,
      valueGetter: (params) => !!params.data?.isFavorite,
      cellRenderer: FavoriteToggleCell,
      cellRendererParams: { suppressReactFrameworkComponentRecreation: false },
      volatile: true,
    },
    { headerName: 'Spelarnamn', colId: 'spelarnamn', field: 'spelarnamn', sortable: true, filter: true, pinned: 'left', hide: !colVisibility['spelarnamn'] },
    {
      headerName: 'Tröjnummer',
      colId: 'jersey_number',
      field: 'jerseyNumber',
      pinned: 'left',
      width: 130,
      sortable: true,
      filter: true,
      editable: true,
      singleClickEdit: true,
      hide: !colVisibility['jersey_number'],
      valueGetter: (params) =>
        (params.data && params.data.jerseyNumber !== undefined ? params.data.jerseyNumber : ''),
      valueSetter: (params) => {
        const v = sanitizeJersey(params.newValue);
        params.data.jerseyNumber = v === '' ? '' : v;
        return true;
      },
      cellEditor: 'agTextCellEditor',
      valueParser: (params) => sanitizeJersey(params.newValue),
      onCellValueChanged,
    },
    { headerName: 'Kön', colId: 'kon', field: 'kon', sortable: true, filter: true, hide: !colVisibility['kon'] },
    { headerName: 'Ålderspelare', colId: 'alderspelare', field: 'alderspelare', sortable: true, filter: true, hide: !colVisibility['alderspelare'] },
    { headerName: 'Klubblag', colId: 'klubblag', field: 'klubblag', sortable: true, filter: true, hide: !colVisibility['klubblag'] },
    { headerName: 'Basket Position', colId: 'basket_position', field: 'basket_position', sortable: true, filter: true, hide: !colVisibility['basket_position'] },
    { headerName: 'Aktuell Serie', colId: 'aktuellserie', field: 'aktuellserie', sortable: true, filter: true, hide: !colVisibility['aktuellserie'] },
    { headerName: 'Mobilnummer', colId: 'mobilnummer', field: 'mobilnummer', sortable: true, filter: true, hide: !colVisibility['mobilnummer'] },
    { headerName: 'Spelarmejl', colId: 'spelarmejl', field: 'spelarmejl', sortable: true, filter: true, hide: !colVisibility['spelarmejl'] },
    { headerName: 'T-Shirt storlek', colId: 'tshirt_storlek', field: 'tshirt_storlek', sortable: true, filter: true, hide: !colVisibility['tshirt_storlek'] },
    { headerName: 'Föräldrar namn', colId: 'parent_name', field: 'name', sortable: true, filter: true, hide: !colVisibility['parent_name'] },
    { headerName: 'Föräldrar Email', colId: 'parent_email', field: 'email', sortable: true, filter: true, hide: !colVisibility['parent_email'] },
    { headerName: 'Föräldrar Telefon', colId: 'parent_phone', field: 'phone', sortable: true, filter: true, hide: !colVisibility['parent_phone'] },
    { headerName: 'Föräldrar Adress', colId: 'parent_address', field: 'address', sortable: true, filter: true, hide: !colVisibility['parent_address'] },
    ...camps.flatMap((camp, campIndex) => [
      {
        headerName: `${camp} Anmäld`,
        valueGetter: (params) => {
          const regs = params.data?.registeredCamps;
          return (Array.isArray(regs) && regs[campIndex]) ? 'Ja' : 'Nej';
        },
        width: 130
      },
      {
        headerName: camp,
        headerClass: `camp-header-${campIndex}`,
        children: [
          ...categories.map((cat, catIndex) => ({
            headerName: categoryTitles[catIndex],
            editable: (params) => !!params.data?.registeredCamps?.[campIndex],
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: ['A', 'B', 'C', 'D', 'E', 'F'] },
            singleClickEdit: true,
            valueGetter: (params) => {
              const ratings = params.data?.ratings;
              if (!Array.isArray(ratings) || !ratings[campIndex]) return 'F';
              return ratings[campIndex][cat] || 'F';
            },
            valueSetter: (params) => {
              if (!params.data.ratings) params.data.ratings = [{},{},{},{},{}];
              if (!params.data.ratings[campIndex]) params.data.ratings[campIndex] = {};
              params.data.ratings[campIndex][cat] = params.newValue;
              return true;
            },
            valueParser: (params) => {
              const v = (params.newValue || '').toString().trim().toUpperCase();
              return ['A','B','C','D','E','F'].includes(v) ? v : 'F';
            },
            onCellValueChanged,
            campIndex,
            cat
          })),
          {
            headerName: 'Genomsnitt',
            cellRenderer: (params) => ratingAverageRenderer(params, campIndex),
            valueGetter: (params) => calculateAverage(params.data?.ratings?.[campIndex] || {}),
            colId: `average_${campIndex}`
          },
          {
            headerName: 'Kommentarer',
            colId: `comments_${campIndex}`,
            singleClickEdit: true,
            editable: (params) => !!params.data?.registeredCamps?.[campIndex],
            cellEditor: 'agLargeTextCellEditor',
            cellRenderer: (params) => commentsRenderer(params, campIndex),
            width: 300,
            valueGetter: (params) => {
              const comments = params.data?.comments;
              if (!Array.isArray(comments) || !comments[campIndex]) return '';
              return comments[campIndex].value || '';
            },
            valueSetter: (params) => {
              if (!params.data.comments) {
                params.data.comments = [
                  { value:'',by:'',timestamp:'' },
                  { value:'',by:'',timestamp:'' },
                  { value:'',by:'',timestamp:'' },
                  { value:'',by:'',timestamp:'' },
                  { value:'',by:'',timestamp:'' }
                ];
              }
              if (!params.data.comments[campIndex]) {
                params.data.comments[campIndex] = { value: '', by: '', timestamp: '' };
              }
              params.data.comments[campIndex].value = params.newValue;
              return true;
            },
            onCellValueChanged
          }
        ]
      }
    ])
  ], [ratingAverageRenderer, calculateAverage, onCellValueChanged, colVisibility]);

  // ---- Filter “visa favoriter” --------------------------------------------------
  const displayRows = useMemo(() => {
    return showOnlyFavorites ? rowData.filter(r => r.isFavorite) : rowData;
  }, [rowData, showOnlyFavorites]);

  const renderCategoryInfo = (title, description) => (
    <Box key={title} mb="4">
      <Heading size="md">{title}</Heading>
      <Text>{description}</Text>
    </Box>
  );

  // ---- Export helpers ------------------------------------------------------------
  const downloadTextFile = (filename, text, type = 'text/csv;charset=utf-8') => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (v) => {
    const s = (v ?? '').toString();
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  // Export only player + parent emails (current view)
  const handleExportEmails = () => {
    const rows = (showOnlyFavorites ? rowData.filter(r => r.isFavorite) : rowData);
    const header = ['Spelarnamn','Tröjnummer','Spelarens e-post','Föräldrar namn','Föräldrar e-post','Klubblag','Aktuell serie','Mobilnummer'];
    const lines = [header.join(',')];
    rows.forEach(r => {
      lines.push([
        escapeCsv(r.spelarnamn || ''),
        escapeCsv(r.jerseyNumber !== undefined ? r.jerseyNumber : ''),
        escapeCsv(r.spelarmejl || ''),
        escapeCsv(r.name || ''),
        escapeCsv(r.email || ''),
        escapeCsv(r.klubblag || ''),
        escapeCsv(r.aktuellserie || ''),
        escapeCsv(r.mobilnummer || r.phone || '')
      ].join(','));
    });
    downloadTextFile('player_parent_emails.csv', lines.join('\n'));
  };

  // Export the grid as CSV via ag-Grid (matches current visible columns & rows)
  const handleExportGridCsv = () => {
    try {
      const api = gridRef.current?.api;
      if (!api) return;
      api.exportDataAsCsv({
        fileName: 'playerlist_view.csv',
        allColumns: false,       // only currently visible columns
        onlySelectedAllPages: false,
        suppressQuotes: false,
      });
    } catch (e) {
      console.warn('CSV export failed', e);
      toast({
        title: 'Export misslyckades',
        description: 'Kunde inte exportera CSV. Prova igen.',
        status: 'error', duration: 2500, isClosable: true, position: 'bottom-right'
      });
    }
  };

  return (
    <Card p='20px' borderRadius='20px' boxShadow='lg' mt='20px' bg='white' w='100%'>
      <Flex justify='space-between' align='center' mb='4'>
        <Heading size='lg' color={textColor}>Registrerade Spelare till Tryout & Läger</Heading>
        <Flex>
          <Text mr='4' fontSize='sm' color='gray.600'>Antal spelare: {displayRows.length}</Text>
          <Button style={{ backgroundColor: 'lightgreen' }} size='sm' ml='2' onClick={onOpen}>Betyg system</Button>
          <Button style={{ backgroundColor: 'lightblue' }} size='sm' ml='2' onClick={() => setShowOnlyFavorites(v => !v)}>
            {showOnlyFavorites ? 'Visa alla anmälda spelare' : 'Visa mina sparade favorit spelare'}
          </Button>
          <Popover placement='bottom-end' isOpen={colPicker.isOpen} onClose={colPicker.onClose}>
            <PopoverTrigger>
              <Button ml='2' size='sm' onClick={colPicker.onToggle}>Kolumner</Button>
            </PopoverTrigger>
            <PopoverContent w='280px'>
              <PopoverArrow />
              <PopoverCloseButton />
              <PopoverBody>
                <Text fontSize='sm' mb='2' color='gray.600'>Välj vilka kolumner som ska visas</Text>
                {TOGGLABLE_COLUMNS.map(c => (
                  <Flex key={c.id} align='center' mb='1'>
                    <Checkbox
                      isChecked={!!colVisibility[c.id]}
                      onChange={(e) => {
                        const next = { ...colVisibility, [c.id]: e.target.checked };
                        setColVisibility(next);
                        // tillämpa direkt på grid
                        const colApi = gridRef.current?.columnApi;
                        if (colApi) colApi.applyColumnState({ state: [{ colId: c.id, hide: !e.target.checked }] });
                      }}
                    >{c.label}</Checkbox>
                  </Flex>
                ))}
                <Flex mt='3' gap='2'>
                  <Button size='sm' colorScheme='blue' onClick={() => {
                    try {
                      localStorage.setItem(COL_KEY, JSON.stringify(colVisibility));
                      const colApi = gridRef.current?.columnApi;
                      if (colApi) {
                        const state = Object.entries(colVisibility).map(([colId, visible]) => ({ colId, hide: !visible }));
                        colApi.applyColumnState({ state, applyOrder: false });
                      }
                      toast({
                        title: 'Kolumnval sparade',
                        description: 'Dina val kommer att ligga kvar till nästa gång.',
                        status: 'success',
                        duration: 2000,
                        isClosable: true,
                        position: 'bottom-right'
                      });
                      colPicker.onClose();
                    } catch (_) {
                      toast({
                        title: 'Kunde inte spara',
                        description: 'Kontrollera webbläsarens lagringsinställningar.',
                        status: 'error',
                        duration: 2500,
                        isClosable: true,
                        position: 'bottom-right'
                      });
                    }
                  }}>Spara</Button>
                  <Button size='sm' variant='outline' onClick={() => {
                    const allOn = {};
                    TOGGLABLE_COLUMNS.forEach(x => { allOn[x.id] = true; });
                    setColVisibility(allOn);
                    localStorage.setItem(COL_KEY, JSON.stringify(allOn));
                    const colApi = gridRef.current?.columnApi;
                    if (colApi) colApi.applyColumnState({ state: TOGGLABLE_COLUMNS.map(x => ({ colId: x.id, hide: false })) });
                  }}>Återställ</Button>
                </Flex>
              </PopoverBody>
            </PopoverContent>
          </Popover>
          <Button ml='2' size='sm' leftIcon={<DownloadIcon />} onClick={handleExportEmails}>
            Exportera e‑post (spelare + förälder)
          </Button>
          <Button ml='2' size='sm' variant='outline' leftIcon={<DownloadIcon />} onClick={handleExportGridCsv}>
            Exportera CSV (nuvarande vy)
          </Button>
          <Button ml='2' size='sm' variant='outline' onClick={() => {
            sessionStorage.removeItem(CACHE_KEY);
            // keep overrides but refresh data
            fetchPlayers();
          }}>Uppdatera lista</Button>
        </Flex>
      </Flex>
      <Text mb='4' color='secondaryGray.700'>Ha tålamod, det tar en stund att ladda alla spelare.
      </Text>

      <style>
        {`
          .camp-header-0 { background-color: #f0f8ff; } /* AliceBlue for Läger 1 */
          .camp-header-1 { background-color: #f5f5dc; } /* Beige for Läger 2 */
          .camp-header-2 { background-color: #fffacd; } /* LemonChiffon for Läger 3 */
          .camp-header-3 { background-color: #fafad2; } /* LightGoldenrodYellow for Läger 4 */
          .camp-header-4 { background-color: #f0fff0; } /* Honeydew for Läger 5 */
          .ag-body-horizontal-scroll { height: 30px !important; }
          .ag-body-horizontal-scroll-viewport { background-color: #ccc; }
          .ag-body-horizontal-scroll-container { background-color: #ccc; }
          .ag-horizontal-left-spacer, .ag-horizontal-right-spacer { background-color: #ccc; }
          .ag-body-horizontal-scroll-thumb { background-color: #555; height: 30px; border-radius: 5px; }
          .grid-loading .ag-overlay-no-rows-center { display: none !important; }
        `}
      </style>

      <div className={"ag-theme-quartz" + (isLoading ? " grid-loading" : "")} style={{ height: 650, width: '100%', position: 'relative' }}>
        {isLoading && (
          <Flex position='absolute' top={0} left={0} right={0} bottom={0} align='center' justify='center' zIndex={1} bg='rgba(255,255,255,0.6)'>
            <Flex direction='column' align='center'>
              <Spinner thickness='4px' size='xl' />
              <Text mt='3' fontSize='sm' color='gray.700'>{`Laddar spelare… (${loadedCount || 0})`}</Text>
            </Flex>
          </Flex>
        )}
        <AgGridReact
          ref={gridRef}
          rowData={displayRows}
          columnDefs={columnDefs}
          pagination={true}
          paginationPageSize={100}
          paginationPageSizeSelector={[50, 100, 200, 500, 1000]}
          getRowStyle={getRowStyle}
          stopEditingWhenCellsLoseFocus={true}
          onGridReady={onGridReady}
          onFirstDataRendered={onFirstDataRendered}
          suppressClickEdit={false}
          suppressRowClickSelection={true}
          rowSelection={undefined}
          getRowId={(params) => String(params.data?.id)}
          immutableData={true}
        />
      </div>

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Betyg Förklaringar</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb="4">
              Ange betyg för varje läger och kategori A-F, där A är högsta betyget.
              All betyg synkas och räknas ut snittet på spelarens läger status. Grunden är F i betyg. 
            </Text>
            {renderCategoryInfo('Bollkontroll', 'Spelarens teknik med boll, förmåga att hantera press, dribbla med båda händer, samt kontroll under matchtempo. Bedömning grundas på bollsäkerhet, rytm och kreativitet i spelet.')}
            {renderCategoryInfo('Försvar', 'Individens förmåga att hålla sin spelare, förstå rotationsprinciper, sätta press, hjälpa laget och visa fysisk samt mental närvaro i försvarsspelet.')}
            {renderCategoryInfo('Anfall', 'Hur spelaren rör sig utan boll, beslutsfattande i 1v1, avslutsförmåga, spelförståelse i passningar och tempo, samt helhet i anfallsspelet.')}
            {renderCategoryInfo('Kommunikation', 'I vilken grad spelaren styr, pratar, tar ansvar för sina medspelare och kommunicerar aktivt i både försvar och anfall – verbalt och icke-verbalt.')}
            {renderCategoryInfo('Sociala egenskaper', 'Ledarskap, energi, coachbarhet, hur spelaren bidrar till lagets kemi, ansvarstagande utanför planen och förmåga att samarbeta i grupp.')}
            {renderCategoryInfo('Styrka/Kondition', 'Fysisk kapacitet att hantera matchtempo, återhämta sig, orka hela vägen i försvar/anfall, samt styrka i närkamper och fysisk motståndskraft.')}
            {renderCategoryInfo('Spelförståelse', 'Speluppfattning, läsa spelet innan det händer, förstå lagets system, ta rätt beslut i olika moment och se helheten i spelet.')}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Card>
  );
};

export default PlayerList;