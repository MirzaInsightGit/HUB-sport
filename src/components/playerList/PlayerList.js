import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import axios from 'axios';
import { Card, Heading, Flex, Button, Text, useColorModeValue, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, Box, useDisclosure, Spinner } from "@chakra-ui/react";
import { useMsal } from "@azure/msal-react";
import { API_BASE } from '../../config/apiBase';

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
ModuleRegistry.registerModules([AllCommunityModule]);

const camps = ['Läger 1', 'Läger 2', 'Läger 3', 'Läger 4', 'Läger 5'];
const categories = ['bollkontroll', 'forsvar', 'anfall', 'kommunikation', 'sociala', 'styrka', 'spelforstaelse'];

const categoryTitles = ['Bollkontroll', 'Försvar', 'Anfall', 'Kommunikation', 'Sociala egenskaper', 'Styrka/Kondition', 'Spelförståelse'];

// NOTE: används av Azure-registrering (paritet i frontend även om listvyn inte nyttjar den direkt)
const campProducts = {
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
  const gridRef = useRef();
  const [isLoading, setIsLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);


  // ---- Load players + favorites -------------------------------------------------
  const fetchPlayers = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadedCount(0);
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

      // Fallback/komplettering (AVSTÄNGD som standard):
      // Kör alltid om färre än 130 spelare är laddade.
      if (players.length < 130) {
        console.warn('[PlayerList] Fallback aktiverad: endast', players.length, 'spelare från /district/players. Kompletterar via Woo orders...');
        try {
          // Säsong (Aug 1 -> Aug 1)
          const seasonStart = new Date(process.env.REACT_APP_DLT_SEASON_START || '2025-08-01T00:00:00Z');
          const seasonEnd   = new Date(process.env.REACT_APP_DLT_SEASON_END   || '2026-08-01T23:59:59Z');

          // Slå upp DLT-kategori-ID från slug 'dlt' eller env
          const resolveIdFromSlug = async (slug) => {
            if (!slug) return null;
            if (!isNaN(Number(slug))) return Number(slug);
            const r = await axios.get(`${API_BASE}/wc/products/categories`, { params: { slug: String(slug).trim() } });
            const match = Array.isArray(r.data) ? r.data.find(x => x.slug === String(slug).trim()) : null;
            return match ? Number(match.id) : null;
          };
          const dltCategoryId = await resolveIdFromSlug(process.env.REACT_APP_DLT_CATEGORY_ID || 'dlt');

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
          ordersDLT.forEach(o => {
            const childName = getMetaDeep(o, ['dlt_spelarnamn','spelarnamn','spelarens_namn','barnets_namn']) ||
                              `${o?.billing?.first_name || ''} ${o?.billing?.last_name || ''}`.trim();
            const parentName = `${o?.billing?.first_name || ''} ${o?.billing?.last_name || ''}`.trim();
            const parentEmail = o?.billing?.email || '';
            const parentPhone = o?.billing?.phone || '';

          const playerEmail = getMetaDeep(o, ['spelarmejl','player_email','spelare_email']);
            const konRaw = getMetaDeep(o, ['dlt_kon','kon','gender','kön','barnets_kön']) || '';
            const kon = /kvinna|flicka|female|f/i.test(konRaw) ? 'Kvinna/Flicka' : (/man|pojke|male|m/i.test(konRaw) ? 'Man/Pojke' : '');
            const alderspelare = getMetaDeep(o, ['dlt_alderspelare','fodelsear','födelseår','birthyear']) || '';
            const klubblag = getMetaDeep(o, ['dlt_klubblag','klubblag','klubb']) || '';
            const basket_position = getMetaDeep(o, ['dlt_basket_position','basket_position','position']) || '';
            const aktuellserie = getMetaDeep(o, ['dlt_aktuellserie','aktuellserie','serie']) || '';
            const mobilnummer = getMetaDeep(o, ['dlt_mobilnummer','mobilnummer','telefon','phone']) || parentPhone;
            const spelarmejl = playerEmail || '';
            const tshirt_storlek = getMetaDeep(o, ['dlt_tshirt','tshirt','t-shirt','storlek']) || '';

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
              attributes: (o.line_items && o.line_items[0] && o.line_items[0].attributes) || [],
              registeredCamps: [false,false,false,false,false],
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
        const apiScopeStr = process.env.REACT_APP_API_SCOPE || '';
        const scopes = apiScopeStr
          ? apiScopeStr.split(',').map((s) => s.trim()).filter(Boolean)
          : [`api://${process.env.REACT_APP_API_CLIENT_ID}/.default`];

        let headers = {};
        try {
          const tokenResp = await instance.acquireTokenSilent({ scopes, account: accounts[0] });
          if (tokenResp?.accessToken) headers.Authorization = `Bearer ${tokenResp.accessToken}`;
        } catch (_) { /* dev utan token */ }
        headers['x-dev-coachid'] = accounts?.[0]?.username || accounts?.[0]?.localAccountId || 'local-dev';

        const res = await fetch(`${API_BASE}/favorites`, { headers });
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
        const spelarmejl = pick(p.spelarmejl, p.playerEmail);
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

        return {
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
      const playersWithFav = (players || []).map((p) => ({ ...normalize(p), isFavorite: favSet.has(p.id) }));
      console.log('[PlayerList] total players loaded:', playersWithFav.length);
      // Dedupe per spelare: robust gruppnyckel (email, annars phone, annars year, annars name)
      const norm = (s) => (s || '').toString().trim().toLowerCase();
      const richness = (p) => [p.spelarmejl,p.mobilnummer,p.tshirt_storlek,p.klubblag,p.basket_position,p.aktuellserie].filter(x => x && String(x).trim()).length;
      const groups = new Map();
      for (const p of playersWithFav) {
        const nameKey = norm(p.spelarnamn);
        const emailKey = norm(p.spelarmejl);
        const phoneKey = normalizePhone(p.mobilnummer);
        const yearKey = String(p.alderspelare || '').trim();
        let key;
        if (emailKey) key = `n:${nameKey}|e:${emailKey}`;
        else if (phoneKey) key = `n:${nameKey}|p:${phoneKey}`;
        else if (yearKey) key = `n:${nameKey}|y:${yearKey}`;
        else key = `n:${nameKey}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
      }
      const deduped = [];
      for (const [, arr] of groups.entries()) {
        // välj bästa kandidat i gruppen
        let best = arr[0];
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
      setRowData(deduped);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching players:', error.response ? error.response.data : error.message);
      setIsLoading(false);
    }
  }, [instance, accounts]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // ---- Favorit-toggle -----------------------------------------------------------
  const toggleFavorite = async (player) => {
    try {
      const apiScopeStr = process.env.REACT_APP_API_SCOPE || '';
      const scopes = apiScopeStr
        ? apiScopeStr.split(',').map(s => s.trim()).filter(Boolean)
        : [`api://${process.env.REACT_APP_API_CLIENT_ID}/.default`];

      let headers = { 'Content-Type': 'application/json' };
      try {
        const tokenResp = await instance.acquireTokenSilent({ scopes, account: accounts[0] });
        if (tokenResp?.accessToken) headers.Authorization = `Bearer ${tokenResp.accessToken}`;
      } catch (_) { /* dev utan token */ }
      headers['x-dev-coachid'] = accounts?.[0]?.username || accounts?.[0]?.localAccountId || 'local-dev';

      if (favorites.has(player.id)) {
        await fetch(`${API_BASE}/favorites`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ playerId: player.id })
        });
        const next = new Set(favorites);
        next.delete(player.id);
        setFavorites(next);
        setRowData(prev => prev.map(r => r.id === player.id ? { ...r, isFavorite: false } : r));
      } else {
        await fetch(`${API_BASE}/favorites`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ playerId: player.id })
        });
        const next = new Set(favorites);
        next.add(player.id);
        setFavorites(next);
        setRowData(prev => prev.map(r => r.id === player.id ? { ...r, isFavorite: true } : r));
      }
    } catch (e) {
      console.error('Toggle favorite failed:', e);
    }
  };

  // ---- Spara rating/kommentar --------------------------------------------------
  const savePlayerData = async (playerId, data) => {
    try {
      const apiScopeStr = process.env.REACT_APP_API_SCOPE || '';
      const scopes = apiScopeStr
        ? apiScopeStr.split(',').map(s => s.trim()).filter(Boolean)
        : [`api://${process.env.REACT_APP_API_CLIENT_ID}/.default`];

      let headers = { 'Content-Type': 'application/json' };
      try {
        const tokenResp = await instance.acquireTokenSilent({ scopes, account: accounts[0] });
        if (tokenResp?.accessToken) headers.Authorization = `Bearer ${tokenResp.accessToken}`;
      } catch (_) { /* fallback dev-mode */ }

      console.log('⬆️ POST /ratings sending:', { playerId, data, headers });

      const response = await axios.post(`${API_BASE}/district/players/${playerId}/ratings`, data, { headers });
      console.log('✔️ Betyg sparat:', response.data);
    } catch (err) {
      console.error('❌ Kunde inte spara betyg:', err?.response?.data || err.message);
    }
  };

  // ---- Grid handlers ------------------------------------------------------------
  const onCellValueChanged = async (params) => {
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
    }

    if (needSave) {
      const item = {
        id: params.data.id,
        ratings: params.data.ratings,
        comments: params.data.comments
      };
      await savePlayerData(params.data.id, item);
    }
  };

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

  const calculateAverage = (rating) => {
    const values = categories.map(key => gradeToNumber(rating?.[key] || 'F'));
    const averageNum = (values.reduce((a, b) => a + b, 0) / categories.length);
    return ['A', 'B', 'C', 'D', 'E', 'F'][5 - Math.round(averageNum)];
  };

  const ratingAverageRenderer = (params, campIndex) => {
    const rating = (params.data?.ratings && params.data.ratings[campIndex]) ? params.data.ratings[campIndex] : {};
    const averageGrade = calculateAverage(rating);
    const by = rating.by ? ` by ${rating.by}` : '';
    const ts = rating.timestamp ? ` at ${new Date(rating.timestamp).toLocaleString()}` : '';
    return averageGrade + ' (genomsnitt)' + by + ts;
  };

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
  };

  // ---- Heart cell ---------------------------------------------------------------
  const HeartCell = (props) => {
    const isFav = props.data?.isFavorite;
    const onClick = () => toggleFavorite(props.data);
    return (
      <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={onClick}>
        {isFav ? '❤️' : '🤍'}
      </span>
    );
  };

  // ---- Column defs --------------------------------------------------------------
  const columnDefs = useMemo(() => [
    {
      headerName: '❤',
      width: 80,
      pinned: 'left',
      cellRenderer: HeartCell
    },
    { headerName: 'Spelarnamn', field: 'spelarnamn', sortable: true, filter: true, pinned: 'left' },
    { headerName: 'Kön', field: 'kon', sortable: true, filter: true },
    { headerName: 'Ålderspelare', field: 'alderspelare', sortable: true, filter: true },
    { headerName: 'Klubblag', field: 'klubblag', sortable: true, filter: true },
    { headerName: 'Basket Position', field: 'basket_position', sortable: true, filter: true },
    { headerName: 'Aktuell Serie', field: 'aktuellserie', sortable: true, filter: true },
    { headerName: 'Mobilnummer', field: 'mobilnummer', sortable: true, filter: true },
    { headerName: 'Spelarmejl', field: 'spelarmejl', sortable: true, filter: true },
    { headerName: 'T-Shirt storlek', field: 'tshirt_storlek', sortable: true, filter: true },
    { headerName: 'Föräldrar namn', field: 'name', sortable: true, filter: true },
    { headerName: 'Föräldrar Email', field: 'email', sortable: true, filter: true },
    { headerName: 'Föräldrar Telefon', field: 'phone', sortable: true, filter: true },
    { headerName: 'Föräldrar Adress', field: 'address', sortable: true, filter: true },
    ...camps.flatMap((camp, campIndex) => [
      {
        headerName: `${camp} Anmäld`,
        valueGetter: (params) => {
          const regs = params.data?.registeredCamps;
          return (Array.isArray(regs) && regs[campIndex]) ? 'Ja' : 'Nej';
        },
        width: 120
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
  ], [ratingAverageRenderer, calculateAverage, onCellValueChanged, HeartCell]);

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

  return (
    <Card p='20px' borderRadius='20px' boxShadow='lg' mt='20px' bg='white' w='100%'>
      <Flex justify='space-between' align='center' mb='4'>
        <Heading size='lg' color={textColor}>Registrerade Spelare till Tryout & Läger</Heading>
        <Flex>
          <Text mr='4' fontSize='sm' color='gray.600'>Antal spelare: {displayRows.length}</Text>
          <Button style={{ backgroundColor: 'lightgreen' }} size='sm' ml='2' onClick={onOpen}>Till dig coach! Betyg system för spelare</Button>
          <Button style={{ backgroundColor: 'lightblue' }} size='sm' ml='2' onClick={() => setShowOnlyFavorites(v => !v)}>
            {showOnlyFavorites ? 'Visa alla anmälda spelare' : 'Visa mina sparade favorit spelare'}
          </Button>
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