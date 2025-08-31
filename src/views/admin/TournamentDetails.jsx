// src/views/admin/TournamentDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import {
  Box,
  Heading,
  Text,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Spinner,
  Button,
  HStack,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Stack,
  StackDivider,
  Avatar,
  Tag,
  TagLabel,
  Divider,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Select,
} from "@chakra-ui/react";
import {
  useProfixioTournamentMatches,
  useProfixioTournamentTeams,
} from "../../hooks/useProfixio";
import {
  getMatchEvents,
  getMatchLineup,
  getMatchDetails,
  getMatchStats,
  getTournament,
} from "../../api/profixioApi";

import { API_BASE } from "../../config/apiBase";

import useAuth from "../../hooks/useAuth";

// ---- Helpers to show "Nivå" (levels) first and sorted naturally ----
const _normalizeLabel = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Returns sort key for a category name; "Nivå 1/2A/2B..." first in natural order
const _levelKey = (name) => {
  const t = _normalizeLabel(name).toLowerCase();
  const m = t.match(/niva\s*(\d+)\s*([a-z])?/i);
  if (!m) return { isLevel: false, n: 0, letter: "" };
  const n = Number(m[1] || 0);
  const letter = (m[2] || "").toLowerCase();
  return { isLevel: true, n, letter };
};

const sortCategoriesNatural = (a, b) => {
  const ka = _levelKey(a.name);
  const kb = _levelKey(b.name);
  if (ka.isLevel !== kb.isLevel) return ka.isLevel ? -1 : 1; // levels first
  if (ka.isLevel && kb.isLevel) {
    if (ka.n !== kb.n) return ka.n - kb.n;
    // A before B before others
    if (ka.letter !== kb.letter) return ka.letter.localeCompare(kb.letter, "sv");
  }
  return _normalizeLabel(a.name).localeCompare(_normalizeLabel(b.name), "sv");
};

const dedupeByName = (arr) => {
  const seen = new Set();
  const out = [];
  for (const it of arr) {
    const key = _normalizeLabel(it.name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
};
// -------------------------------------------------------------------


const normalizeMatches = (raw) => {
  const list = Array.isArray(raw) ? raw : raw?.data || [];

  const pickTeamName = (...c) => {
    for (const v of c) {
      if (!v) continue;
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "object") {
        const name = v?.name || v?.team || v?.teamName || v?.displayName;
        if (typeof name === "string" && name.trim()) return name.trim();
      }
    }
    return "—";
  };

  const readScore = (m, side) => {
    const s = side;
    const direct =
      m?.[`${s}Score`] ??
      m?.[`${s}_score`] ??
      m?.[`${s}Goals`] ??
      m?.[`${s}_goals`] ??
      m?.[`${s}Points`] ??
      m?.[`${s}_points`] ??
      m?.[`${s}Result`] ??
      m?.[`${s}_result`] ??
      m?.[`result_${s}`] ??
      m?.[`score_${s}`] ??
      m?.[`goals_${s}`];
    if (typeof direct === "number") return direct;
    if (typeof direct === "string" && direct.trim() && !isNaN(Number(direct)))
      return Number(direct);

    const teams = m?.teams || m?.team || {};
    const sideObj =
      (s === "home" ? teams.home : teams.away) ||
      (Array.isArray(teams)
        ? teams.find((t) =>
            (t.side || t.location || "").toString().toLowerCase().includes(s)
          )
        : null);
    const fromSide =
      sideObj?.goals ??
      sideObj?.score ??
      sideObj?.points ??
      sideObj?.result ??
      sideObj?.[`${s}Score`];
    if (typeof fromSide === "number") return fromSide;
    if (
      typeof fromSide === "string" &&
      fromSide.trim() &&
      !isNaN(Number(fromSide))
    )
      return Number(fromSide);

    const resStr = (m?.result || m?.score || m?.final || "").toString();
    if (resStr.includes("-") || resStr.includes("–")) {
      const sep = resStr.includes("–") ? "–" : "-";
      const [h, a] = resStr.split(sep).map((x) => Number(String(x).trim()));
      if (!Number.isNaN(h) && !Number.isNaN(a)) return s === "home" ? h : a;
    }

    const fromObj = m?.score || m?.scores || m?.resultObj || {};
    const cand = fromObj?.[s];
    if (typeof cand === "number") return cand;
    if (typeof cand === "string" && cand.trim() && !isNaN(Number(cand)))
      return Number(cand);

    return null;
  };

  return list.map((m) => {
    const homeName = pickTeamName(
      m?.homeTeamName,
      m?.homeTeam,
      m?.home?.name,
      m?.home,
      m?.teams?.home?.team,
      m?.teams?.home?.name,
      m?.teams?.home
    );
    const awayName = pickTeamName(
      m?.awayTeamName,
      m?.awayTeam,
      m?.away?.name,
      m?.away,
      m?.teams?.away?.team,
      m?.teams?.away?.name,
      m?.teams?.away
    );

    const hs = readScore(m, "home");
    const as = readScore(m, "away");

    let result = "—";
    if (hs != null && as != null) result = `${hs}–${as}`;
    else if (typeof m?.result === "string" && m.result.trim())
      result = m.result.replace("-", "–");
    else if (typeof m?.score === "string" && m.score.trim())
      result = m.score.replace("-", "–");

    return {
      id: m?.id ?? m?.matchId ?? m?.code,
      home: homeName,
      away: awayName,
      result,
      date:
        m?.start ??
        m?.date ??
        m?.startDate ??
        m?.gameTime ??
        m?.played_at ??
        null,
    };
  });
};

const normalizeTeams = (raw) => {
  const list = Array.isArray(raw) ? raw : raw?.data || [];
  return list.map((t) => ({
    id: t?.id ?? t?.teamId ?? t?.code,
    name: t?.name ?? t?.teamName ?? "—",
    seed: t?.seed ?? t?.seeding ?? null,
    players: Array.isArray(t?.players) ? t.players : [],
  }));
};

const getPointsFromEvent = (ev) => {
  if (!ev) return 0;
  if (typeof ev.points === "number") return ev.points;
  if (typeof ev.value === "number") return ev.value;
  if (typeof ev.score === "number") return ev.score;
  const type = (ev.type || ev.eventType || ev.code || "")
    .toString()
    .toLowerCase();
  if (type.includes("3pt") || type.includes("3-po") || type.includes("trepo"))
    return 3;
  if (type.includes("2pt") || type.includes("2-po")) return 2;
  if (type.includes("1pt") || type.includes("ft") || type.includes("straff"))
    return 1;
  return 0;
};

/* --------------- component --------------- */

export default function TournamentDetails() {
  const { tournamentId } = useParams();
  const location = useLocation();
  // Read initial filter values from URL (?categoryId/groupId or common aliases)
  const initialQuery = useMemo(() => {
    const usp = new URLSearchParams(location.search || "");
    const qCategory = usp.get("categoryId") || usp.get("classId") || usp.get("levelId") || usp.get("category") || usp.get("level");
    const qGroup = usp.get("groupId") || usp.get("poolId") || usp.get("group") || usp.get("pool");
    return {
      categoryId: qCategory != null && qCategory !== "" ? String(qCategory) : null,
      groupId: qGroup != null && qGroup !== "" ? String(qGroup) : null,
    };
  }, [location.search]);
  const { user } = useAuth();
  // Nivåer (kategorier) & grupper för att kunna filtrera
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [categories, setCategories] = useState([]); // [{id, name}]
  const [groups, setGroups] = useState([]); // [{id, name}]
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialQuery.categoryId);
  const [selectedGroupId, setSelectedGroupId] = useState(initialQuery.groupId);
  // Which tab is active: 0 = Topp 20 spelare, 1 = Lagstatistik, 2 = Enskilda Matcher
  const [tabIndex, setTabIndex] = useState(0);

  // Memoiserad bearer för ESLint + stabil deps
  const bearer = useMemo(
    () => user?.accessToken ?? user?.idToken ?? null,
    [user?.accessToken, user?.idToken]
  );

  // Hämta taxonomy (nivåer/kategorier + grupper) för turneringen
  useEffect(() => {
    let abort = false;
    const run = async () => {
      if (!tournamentId) return;
      setTaxonomyLoading(true);
      setCategories([]);
      setGroups([]);
      try {
        const base = String(API_BASE).replace(/\/$/, "");
        const url = `${base}/stats/tournament-taxonomy?tournamentId=${tournamentId}&_=${Date.now()}`;
        const res = await fetch(url, { credentials: "omit", cache: "no-store" }).catch(() => null);
        if (!res || !res.ok) throw new Error("taxonomy fetch failed");
        const json = await res.json().catch(() => ({}));
        if (abort) return;

        // Accept multiple possible shapes from backend
        const rawCats =
          (Array.isArray(json?.categories) && json.categories) ||
          (Array.isArray(json?.levels) && json.levels) ||
          (Array.isArray(json?.categoryList) && json.categoryList) ||
          [];
        const rawGroups =
          (Array.isArray(json?.groups) && json.groups) ||
          (Array.isArray(json?.pools) && json.pools) ||
          (Array.isArray(json?.groupList) && json.groupList) ||
          [];

        let cats = rawCats
          .map((c) => ({
            id: c.id ?? c.categoryId ?? c.levelId ?? c.code ?? c.value ?? null,
            name:
              c.categoryCode ||
              c.name ||
              c.title ||
              c.levelName ||
              c.label ||
              String(c.id ?? c.categoryId ?? c.levelId ?? ""),
          }))
          .filter((c) => c.id != null);
        let grps = rawGroups
          .map((g) => ({
            id: g.id ?? g.groupId ?? g.poolId ?? g.code ?? g.value ?? null,
            name: g.name ?? g.title ?? g.poolName ?? g.label ?? String(g.id ?? g.groupId ?? g.poolId ?? ""),
          }))
          .filter((g) => g.id != null);

        // Always augment with matchCategories from tournament (helps when taxonomy endpoint is thin)
        try {
          const t = await getTournament(tournamentId, bearer).catch(() => null);
          const mc = Array.isArray(t?.matchCategories) ? t.matchCategories : [];
          if (mc.length) {
            const extraCats = mc
              .map((m) => ({
                id: m.id ?? m.categoryId ?? null,
                name: m.categoryCode || m.name || "Kategori",
              }))
              .filter((c) => c.id != null);
            // merge on normalized name or id
            const seen = new Set(
              (cats || []).map((c) => `${c.id}|${_normalizeLabel(c.name).toLowerCase()}`)
            );
            extraCats.forEach((c) => {
              const key = `${c.id}|${_normalizeLabel(c.name).toLowerCase()}`;
              if (!seen.has(key)) {
                cats.push(c);
                seen.add(key);
              }
            });
          }
        } catch (_) {
          // ignore
        }

        // Dedupe and sort: levels ("Nivå ...") first in natural order, then others
        cats = dedupeByName(cats).sort(sortCategoriesNatural);
        setCategories(cats);
        setGroups(grps);

        // Välj initial nivå: 1) URL om satt, annars 2) första "Nivå ..." eller första i listan
        if (!abort) {
          const urlCat = initialQuery.categoryId;
          const defCat = cats.find(c => /niv[aå]/i.test(String(c.name||""))) || cats[0];
          setSelectedCategoryId((prev) => {
            if (prev != null && prev !== "") return prev;
            if (urlCat != null && urlCat !== "") return String(urlCat);
            return defCat ? String(defCat.id) : prev;
          });
          // Om grupp i URL är satt men ej finns i listan ännu, behåll värdet; annars nollställ endast om nivå byts i UI senare
        }
      } catch (_e) {
        // mjuk-fail: lämna tomma listor
      } finally {
        if (!abort) setTaxonomyLoading(false);
      }
    };
    run();
    return () => { abort = true; };
  }, [tournamentId, bearer, initialQuery]);

  // ✨ ADD: tillåt att tvinga maxMatches via querystring vid felsökning
  const maxMatchesOverride = useMemo(() => {
    if (typeof window === "undefined") return null;
    const usp = new URLSearchParams(window.location.search);
    const v = usp.get("maxMatchesOverride");
    const n = v != null ? Number(v) : null;
    return n != null && !Number.isNaN(n) && n > 0 ? n : null;
  }, []); // ✨ ADD

  // pagination
  const [page, setPage] = useState(1);
  const limit = 100;

  const { data: rawMatches, loading: mLoading } =
    useProfixioTournamentMatches(tournamentId, {
      page,
      limit,
      // dessa parametrar ignoreras tyst av hooken om backend inte stödjer dem
      categoryId: selectedCategoryId || undefined,
      groupId: selectedGroupId || undefined,
    });
  const { data: rawTeams, loading: tLoading } =
    useProfixioTournamentTeams(tournamentId, { players: 1 });

  const matches = useMemo(() => normalizeMatches(rawMatches), [rawMatches]);
  const teams = useMemo(() => normalizeTeams(rawTeams), [rawTeams]);

  const meta =
    rawMatches?.meta || {
      current_page: page,
      last_page: page,
      total: matches.length,
    };
  const loading = mLoading || tLoading;

  const canPrev = (meta?.current_page || 1) > 1;
  const canNext = (meta?.current_page || 1) < (meta?.last_page || 1);

  // selection
  const [selectedId, setSelectedId] = useState(null);
  const selected = useMemo(
    () =>
      matches.find((m) => m.id?.toString() === selectedId?.toString()) ||
      matches[0],
    [matches, selectedId]
  );

  // score för vald match
  const [selectedScore, setSelectedScore] = useState(null);

  // topscorers
  const [topScorers, setTopScorers] = useState({ home: null, away: null });
  const [fetchingScorers, setFetchingScorers] = useState(false);
  const [noEventData, setNoEventData] = useState(false);

  // tournament top scorers (top 20 for entire tournament)
  const [tournamentTop, setTournamentTop] = useState([]);
  const [tournamentTopLoading, setTournamentTopLoading] = useState(false);
  const [tournamentTopError, setTournamentTopError] = useState(null);
  const [tournamentTopUrl, setTournamentTopUrl] = useState(null);
  // UI: allow manual reload on failure or rate-limit
  const [reloadKey, setReloadKey] = useState(0);
  // UI helper: smoother loading text while we try backoffs
  const [fetchStatus, setFetchStatus] = useState("");
  const [softLoading, setSoftLoading] = useState(false);
  // Hur många matcher per spelare vi siktar på att summera
  const [matchDepth, setMatchDepth] = useState(8);
  // ✨ ADD: spåra vilket maxMatches som faktiskt användes
  const [usedMaxMatches, setUsedMaxMatches] = useState(null);
  const triggerReload = () => setReloadKey((x) => x + 1);
  // Memoized: combine duplicate players by stable key and compute per-game avg + mix
  const tournamentTopCombined = useMemo(() => {
    if (!Array.isArray(tournamentTop)) return [];

    // Normalize player name to a stable slug without diacritics/punctuation
    const normalizeName = (name) => {
      return String(name || "")
        .normalize("NFD").replace(/[\u0300-\u036f]+/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const primary = new Map();

    // 1) First pass — merge by playerId when present; otherwise by name+team
    for (const p of tournamentTop) {
      const name = p.name || "Okänd spelare";
      const teamId = p.teamId ?? null;
      const teamName = p.teamName ?? "—";
      const playerId = p.playerId ?? p.personId ?? p.id ?? null;

      // Prefer numeric/string playerId; else fallback to composite name+team key
      const nameKey = normalizeName(name);
      const fallbackKey = `${nameKey}|${teamId ?? teamName}`;
      const key = playerId != null ? `id:${playerId}` : `nt:${fallbackKey}`;

      const cur = primary.get(key) || {
        playerId,
        name,
        number: p.number ?? null,
        teamId,
        teamName,
        points: 0,
        made1: 0,
        made2: 0,
        made3: 0,
        fouls: 0,
        matches: [],
        matchesCount: 0,
        periodPoints: {},
        lastEventAt: p.lastEventAt ?? null,
        _nameKey: nameKey,
      };

      cur.points += Number(p.points ?? 0) || 0;
      cur.made1 += Number(p.made1 ?? p.ft ?? 0) || 0;
      cur.made2 += Number(p.made2 ?? 0) || 0;
      cur.made3 += Number(p.made3 ?? 0) || 0;
      cur.fouls += Number(p.fouls ?? 0) || 0;

      const count = Number(p.matchesCount ?? (Array.isArray(p.matches) ? p.matches.length : 0)) || 0;
      cur.matchesCount += count;

      if (Array.isArray(p.matches)) {
        for (const mid of p.matches) {
          if (!cur.matches.includes(mid)) cur.matches.push(mid);
        }
      }

      if (p.periodPoints && typeof p.periodPoints === 'object') {
        for (const [per, val] of Object.entries(p.periodPoints)) {
          const k = String(per);
          cur.periodPoints[k] = (Number(cur.periodPoints[k] || 0) + (Number(val || 0) || 0));
        }
      }

      if (p.lastEventAt && (!cur.lastEventAt || String(p.lastEventAt) > String(cur.lastEventAt))) {
        cur.lastEventAt = p.lastEventAt;
      }

      primary.set(key, cur);
    }

    // 2) Second pass — if the same person slipped through with different ids, merge by name+team
    const byNameTeam = new Map();
    for (const v of primary.values()) {
      const k = `nt:${v._nameKey}|${v.teamId ?? v.teamName}`;
      const cur = byNameTeam.get(k);
      if (!cur) {
        byNameTeam.set(k, { ...v });
      } else {
        cur.points += v.points;
        cur.made1 += v.made1;
        cur.made2 += v.made2;
        cur.made3 += v.made3;
        cur.fouls += v.fouls;
        cur.matchesCount += v.matchesCount;
        v.matches.forEach((mid) => { if (!cur.matches.includes(mid)) cur.matches.push(mid); });
        Object.entries(v.periodPoints || {}).forEach(([per, val]) => {
          const key = String(per);
          cur.periodPoints[key] = (Number(cur.periodPoints[key] || 0) + (Number(val || 0) || 0));
        });
        if (v.lastEventAt && (!cur.lastEventAt || String(v.lastEventAt) > String(cur.lastEventAt))) {
          cur.lastEventAt = v.lastEventAt;
        }
      }
    }

    // 3) Finalize derived metrics
    const arr = Array.from(byNameTeam.values()).map((x) => {
      const avgPoints = x.matchesCount ? Math.round((x.points / x.matchesCount) * 10) / 10 : x.points;
      const madePts = (x.made3 * 3) + (x.made2 * 2) + (x.made1);
      const mixDen = madePts > 0 ? madePts : x.points || 1; // fallback to points if made breakdown missing
      const threeShare = Math.round(((x.made3 * 3) / mixDen) * 100);
      const twoShare = Math.round(((x.made2 * 2) / mixDen) * 100);
      const oneShare = Math.max(0, 100 - threeShare - twoShare);
      return { ...x, avgPoints, threeShare, twoShare, oneShare };
    });

    // Sort by avg points desc, then total points desc, then name asc
    arr.sort((a, b) => {
      if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints;
      if (b.points !== a.points) return b.points - a.points;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    return arr;
  }, [tournamentTop]);
  // UI: player detail modal (from Top 20 list)
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  // Fetch top 20 scorers for the whole tournament (with downshift/backoff to avoid 504/429)
  // Run this only when the Top 20 tab (index 0) is active to avoid unnecessary load.
  useEffect(() => {
    if (!tournamentId || tabIndex !== 0) {
      // Clear any pending state when tab is not active
      setTournamentTopLoading(false);
      setTournamentTopError(null);
      return;
    }
    let aborted = false;

    const withTimeout = (ms, promise, controller) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => {
            try { controller?.abort(); } catch {}
            reject(new Error(`Timeout efter ${ms} ms`));
          }, ms)
        ),
      ]);

    // Authorization header if we have a bearer from Auth
    const headers = bearer ? { Authorization: `Bearer ${bearer}` } : {};

    // One request that respects 429/Retry-After and supports abort/timeout
    const doRequest = async (url, tries = 2, timeoutMs = 15000) => {
      let lastErr;
      for (let i = 0; i < tries; i++) {
        const ctrl = new AbortController();
        try {
          const res = await withTimeout(
            timeoutMs,
            fetch(url, { credentials: 'omit', headers, signal: ctrl.signal, cache: 'no-store' }),
            ctrl
          );

          // Respect 429 with Retry-After
          if (res.status === 429) {
            const retryAfter = Number(res.headers.get('retry-after'));
            const delayMs = !Number.isNaN(retryAfter) ? retryAfter * 1000 : 800 * (i + 1);
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }

          return res;
        } catch (e) {
          lastErr = e;
          // brief backoff then retry
          await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        }
      }
      if (lastErr) throw lastErr;
      // final attempt
      return fetch(url, { credentials: 'omit', headers, cache: 'no-store' });
    };

    const safeJson = async (res) => {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return res.json();
      const text = await res.text();
      try { return JSON.parse(text); } catch (_) {}
      const snippet = text.slice(0, 140).replace(/\n/g, ' ');
      throw new Error(`Oväntat svar (status ${res.status}): ${snippet}`);
    };

    const run = async () => {
      try {
        setSoftLoading(true);
        setFetchStatus("Förbereder hämtning…");
        setTournamentTopLoading(true);
        setTournamentTopError(null);

        const base = String(API_BASE).replace(/\/$/, '');
        // ✨ CHANGED: limits härleds från matchDepth men stödjer override; vi nollställer även usedMaxMatches före försök
        const d = Number(matchDepth) || 8;
        const baseLimitsDesc = Array.from(new Set([
          d,
          Math.max(5, Math.ceil(d * 0.7)),
          Math.max(3, Math.ceil(d * 0.5)),
          2,
          1,
        ])).filter(n => n > 0);
        // We want to try **smaller first** to return something quickly under poor backends
        const baseLimitsAsc = [...baseLimitsDesc].sort((a,b) => a - b);
        // If user has applied filters (category/group), we can start a bit higher but still small
        const hasFilters = !!(selectedCategoryId || selectedGroupId);
        const preferredStart = hasFilters ? Math.min(5, d) : Math.min(3, d);
        const reordered = [preferredStart, ...baseLimitsAsc.filter(x => x !== preferredStart)];
        const limits = maxMatchesOverride ? [Number(maxMatchesOverride)] : reordered; // ✨ CHANGED
        setUsedMaxMatches(null); // ✨ ADD

        let finalItems = [];
        let lastErrorMessage = '';

        for (let i = 0; i < limits.length; i++) {
          const mm = limits[i];
          setFetchStatus(`Försöker med max ${mm} matcher per spelare…`);
          // ✨ REPLACED: Build URL with filters, now also passing category/group names for backend compatibility
          const params = new URLSearchParams({
            tournamentId: String(tournamentId),
            limit: "20",
            maxMatches: String(mm),
            maxMatchesOverride: String(mm),
            _: String(Date.now()),
          });

          // Include both ID and NAME for category/level, to support backends that expect either
          if (selectedCategoryId != null) {
            const v = String(selectedCategoryId);
            params.set("categoryId", v);
            // aliases some backends use for id
            params.set("category", v);
            params.set("levelId", v);
            params.set("level", v);
            // also pass the category NAME (code/label) if we can resolve it
            const selCat = (Array.isArray(categories) ? categories : []).find(
              (c) => String(c.id) === v
            );
            const catName = selCat?.name;
            if (catName) {
              params.set("categoryName", catName);
              params.set("categoryCode", catName);
              params.set("category_label", catName);
              params.set("categoryText", catName);
            }
          }

          // Include both ID and NAME for group/pool as well
          if (selectedGroupId != null) {
            const v = String(selectedGroupId);
            params.set("groupId", v);
            // id aliases
            params.set("group", v);
            params.set("poolId", v);
            params.set("pool", v);
            const selGrp = (Array.isArray(groups) ? groups : []).find(
              (g) => String(g.id) === v
            );
            const grpName = selGrp?.name;
            if (grpName) {
              params.set("groupName", grpName);
              params.set("groupCode", grpName);
              params.set("poolName", grpName);
            }
          }
          const url = `${base}/stats/top-scorers-from-tournament?${params.toString()}`;
          setTournamentTopUrl(url);
          if (typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('debug') === '1')) {
            // eslint-disable-next-line no-console
            console.log('[Top20] Request URL:', url);
          }

          try {
            const res = await doRequest(url, 2, 15000);
            if (!res.ok) {
              // If 504/502, try next smaller batch; otherwise surface the error
              if (res.status === 504 || res.status === 502) {
                lastErrorMessage = `HTTP ${res.status}`;
                setFetchStatus(`Servern svarade ${res.status}. Provar lägre värde…`);
                continue;
              }
              const txt = await res.text().catch(() => '');
              const snippet = txt.slice(0, 140).replace(/\n/g, ' ');
              throw new Error(`HTTP ${res.status}: ${snippet}`);
            }

            const json = await safeJson(res);
            const items = Array.isArray(json?.items) ? json.items : [];
            finalItems = items;
            setUsedMaxMatches(mm); // ✨ ADD – spara vilket värde som faktiskt lyckades
            setFetchStatus("");
            break; // success
          } catch (err) {
            // Network error or timeout — try smaller batch
            setFetchStatus('Nätverksproblem – provar lägre värde…');
            lastErrorMessage = (err?.name === 'AbortError' || /Timeout/i.test(err?.message || ''))
              ? 'Tidsgräns överskreds (servern svarade inte i tid)'
              : (err?.message || 'Okänt fel');
            continue;
          }
        }

        if (!aborted) {
          if (finalItems.length === 0 && lastErrorMessage) {
            setTournamentTop([]);
            setTournamentTopError(`Kunde inte hämta data (försökte med mindre batchar). Senaste fel: ${lastErrorMessage}`);
          } else {
            setTournamentTop(finalItems);
          }
        }
      } catch (err) {
        if (!aborted) {
          setTournamentTop([]);
          setTournamentTopError(err?.message ? String(err.message) : 'Kunde inte hämta toppscorers.');
        }
      } finally {
        if (!aborted) {
          setSoftLoading(false);
          setFetchStatus("");
          setTournamentTopLoading(false);
        }
      }
    };

    run();
    return () => {
      aborted = true;
    };
  // ✨ CHANGED: lägg till maxMatchesOverride i deps, och filter-deps, samt bearer, categories, groups
  }, [tournamentId, reloadKey, tabIndex, matchDepth, maxMatchesOverride, selectedCategoryId, selectedGroupId, categories, groups, bearer]);

  // Team name -> players[]
  const teamPlayersByName = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => map.set(t.name, t.players || []));
    return map;
  }, [teams]);

  // Fetch match-specific data only when the "Enskilda Matcher" tab is active
  useEffect(() => {
    if (tabIndex !== 2 || !bearer || !tournamentId || !selected?.id) return;

    let cancelled = false;
    const run = async () => {
      try {
        setFetchingScorers(true);

        // details + lineup + events
        const [detailsRes, lineupRes, eventsRes] = await Promise.all([
          getMatchDetails(tournamentId, selected.id, bearer).catch(() => null),
          getMatchLineup(tournamentId, selected.id, bearer).catch(() => null),
          getMatchEvents(tournamentId, selected.id, bearer).catch(() => null),
        ]);

        // score
        const details = detailsRes?.data ?? detailsRes ?? {};
        const toNum = (v) =>
          v == null ? null : isNaN(Number(v)) ? null : Number(v);
        const h =
          toNum(details?.homeScore) ??
          toNum(details?.home_points) ??
          toNum(details?.score?.home) ??
          toNum(details?.result_home) ??
          toNum(details?.homeTeam?.goals);
        const a =
          toNum(details?.awayScore) ??
          toNum(details?.away_points) ??
          toNum(details?.score?.away) ??
          toNum(details?.result_away) ??
          toNum(details?.awayTeam?.goals);
        if (h != null && a != null) setSelectedScore(`${h}–${a}`);
        else if (typeof details?.result === "string" && details.result.trim())
          setSelectedScore(details.result.replace("-", "–"));
        else setSelectedScore(null);

        // lineup -> playerMeta (side + name)
        const playerMeta = new Map();
        const pushPlayer = (raw, sideHint) => {
          if (!raw) return;
          const pid =
            raw?.personId ??
            raw?.playerId ??
            raw?.globalPlayerId ??
            raw?.id ??
            raw?.number;
          const name =
            raw?.name ||
            raw?.fullName ||
            (raw?.firstName && raw?.lastName
              ? `${raw.firstName} ${raw.lastName}`
              : raw?.firstName || raw?.lastName);
          if (pid != null)
            playerMeta.set(String(pid), {
              name: name || "Okänd spelare",
              side: sideHint,
            });
        };

        if (lineupRes?.home?.players || lineupRes?.away?.players) {
          (lineupRes?.home?.players || []).forEach((p) => pushPlayer(p, "home"));
          (lineupRes?.away?.players || []).forEach((p) => pushPlayer(p, "away"));
        } else {
          const lineupList = Array.isArray(lineupRes?.data)
            ? lineupRes.data
            : Array.isArray(lineupRes)
            ? lineupRes
            : [];
          lineupList.forEach((p) => {
            const sideRaw = (p?.teamSide || p?.side || "")
              .toString()
              .toLowerCase();
            const side = sideRaw.includes("away") ? "away" : "home";
            pushPlayer(p, side);
          });
        }

        // events
        const events = Array.isArray(eventsRes?.data)
          ? eventsRes.data
          : Array.isArray(eventsRes)
          ? eventsRes
          : [];
        const hasEvents = Array.isArray(events) && events.length > 0;
        setNoEventData(!hasEvents);

        let computed = false;

        // fallback: stats/boxscore om events saknas
        if (!hasEvents) {
          try {
            const statsRes = await getMatchStats(
              tournamentId,
              selected.id,
              bearer
            ).catch(() => null);
            const stats = statsRes?.data ?? statsRes ?? null;

            if (stats) {
              const candidatePlayers = [];
              const pushPlayers = (arr, side) => {
                (arr || []).forEach((p) => {
                  const name =
                    p?.name ||
                    p?.fullName ||
                    (p?.firstName && p?.lastName
                      ? `${p.firstName} ${p.lastName}`
                      : p?.firstName || p?.lastName) ||
                    "Okänd spelare";
                  const points =
                    p?.points ??
                    p?.pts ??
                    p?.totalPoints ??
                    p?.poang ??
                    p?.score ??
                    0;
                  candidatePlayers.push({
                    side,
                    name,
                    points: Number(points) || 0,
                  });
                });
              };

              if (stats?.home?.players || stats?.away?.players) {
                pushPlayers(stats?.home?.players, "home");
                pushPlayers(stats?.away?.players, "away");
              }
              if (Array.isArray(stats?.players)) {
                stats.players.forEach((p) => {
                  const sideRaw = (p?.teamSide || p?.side || p?.team || "")
                    .toString()
                    .toLowerCase();
                  const side = sideRaw.includes("away") ? "away" : "home";
                  const name =
                    p?.name ||
                    p?.fullName ||
                    (p?.firstName && p?.lastName
                      ? `${p.firstName} ${p.lastName}`
                      : p?.firstName || p?.lastName) ||
                    "Okänd spelare";
                  const points =
                    p?.points ??
                    p?.pts ??
                    p?.totalPoints ??
                    p?.poang ??
                    p?.score ??
                    0;
                  candidatePlayers.push({
                    side,
                    name,
                    points: Number(points) || 0,
                  });
                });
              }

              if (candidatePlayers.length) {
                const topHome = candidatePlayers
                  .filter((p) => p.side === "home")
                  .reduce(
                    (acc, cur) => (cur.points > acc.points ? cur : acc),
                    { name: "Okänd spelare", points: 0 }
                  );
                const topAway = candidatePlayers
                  .filter((p) => p.side === "away")
                  .reduce(
                    (acc, cur) => (cur.points > acc.points ? cur : acc),
                    { name: "Okänd spelare", points: 0 }
                  );

                setTopScorers({
                  home:
                    topHome.points > 0
                      ? { name: topHome.name, points: topHome.points }
                      : null,
                  away:
                    topAway.points > 0
                      ? { name: topAway.name, points: topAway.points }
                      : null,
                });
                computed = true;
              }
            }
          } catch {
            /* ignore */
          }
        }

        // normal: events -> tally -> toppscorers
        if (hasEvents && !computed) {
          const tally = new Map();
          events.forEach((ev) => {
            const typeRaw = (
              ev.type ||
              ev.eventType ||
              ev.event ||
              ev.code ||
              ""
            )
              .toString()
              .toLowerCase();
            const pts = getPointsFromEvent({ ...ev, type: typeRaw });
            if (!pts) return;
            const pid =
              ev.playerId ||
              ev.player ||
              ev.globalPlayerId ||
              ev.personId ||
              ev.personID ||
              ev.player_id;
            if (pid == null) return;
            const key = pid.toString();
            tally.set(key, (tally.get(key) || 0) + pts);
          });

          const pickTop = (side) => {
            let top = { name: "Okänd spelare", points: 0 };
            playerMeta.forEach((meta, pid) => {
              if (meta.side !== side) return;
              const pts = tally.get(pid) || 0;
              if (pts > top.points)
                top = { name: meta.name || "Okänd spelare", points: pts };
            });

            // försök mappa via lagroster om 0p
            if (top.points === 0) {
              const roster =
                teamPlayersByName.get(
                  side === "home" ? selected?.home : selected?.away
                ) || [];
              roster.forEach((p) => {
                const pid = p?.id || p?.playerId || p?.globalPlayerId;
                const pts = pid != null ? tally.get(String(pid)) || 0 : 0;
                const nm = p?.name || p?.fullName || "Okänd spelare";
                if (pts > top.points) top = { name: nm, points: pts };
              });
            }

            return top.points > 0 ? top : null;
          };

          setTopScorers({ home: pickTop("home"), away: pickTop("away") });
        }
      } catch {
        if (!cancelled) {
          setTopScorers({ home: null, away: null });
          setSelectedScore(null);
        }
      } finally {
        if (!cancelled) setFetchingScorers(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    tabIndex,
    bearer,
    tournamentId,
    selected?.id,
    selected?.home,
    selected?.away,
    teamPlayersByName,
  ]);

  useEffect(() => {
    if (
      matches.length &&
      (selectedId == null ||
        !matches.find((m) => m.id?.toString() === selectedId?.toString()))
    ) {
      setSelectedId(matches[0].id);
    }
  }, [matches, selectedId]);

  if (loading) {
    return (
      <Box p={6} display="flex" alignItems="center" gap={2}>
        <Spinner /> <Text>Laddar turneringsdata och nivåer…</Text>
      </Box>
    );
  }

  return (
    <Box p={5}>
      <Box display="flex" alignItems="baseline" justifyContent="space-between" mb={4}>
        <Heading as="h1" size="lg">Turnering {tournamentId}</Heading>
        <Badge variant="subtle" colorScheme="purple">ID: {tournamentId}</Badge>
      </Box>

      <Tabs colorScheme="purple" variant="enclosed" index={tabIndex} onChange={setTabIndex}>
        <TabList>
          <Tab>Topp 20 spelare</Tab>
          <Tab>Lagstatistik</Tab>
          <Tab>Enskilda Matcher</Tab>
        </TabList>
        <TabPanels>
          {/* 1) Topp 20 spelare */}
          <TabPanel>
            <Card variant="outline" borderRadius="lg" mb={4}>
              <CardHeader>
                <Heading as="h3" size="md">Top 20 poänggörare – turnering</Heading>
                <Text mt={1} opacity={0.8}>
                  Summerat över alla matcher i turneringen {tournamentId}
                  {selectedCategoryId || selectedGroupId ? (
                    <>
                      {" "}• filter: {selectedCategoryId ? `nivå ${categories.find(c => String(c.id) === String(selectedCategoryId))?.name || "—"}` : "alla nivåer"}
                      {selectedGroupId ? `, grupp ${groups.find(g => String(g.id) === String(selectedGroupId))?.name || "—"}` : ""}
                    </>
                  ) : null}
                </Text>
                <HStack mt={2} spacing={3}>
                  <Text fontSize="sm" opacity={0.8}>Matcher per spelare:</Text>
                  <Select
                    value={matchDepth}
                    onChange={(e) => setMatchDepth(Number(e.target.value))}
                    size="sm"
                    maxW="88px"
                    variant="outline"
                  >
                    {[3, 5, 8, 10, 12, 15].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </Select>
                  <Text fontSize="xs" opacity={0.6}>(backar automatiskt vid behov)</Text>
                </HStack>
                {/* Filter: nivå (kategori) och grupp */}
                {(categories.length > 0 || groups.length > 0) && (
                  <HStack mt={3} spacing={3} flexWrap="wrap">
                    {categories.length > 0 && (
                      <HStack>
                        <Text fontSize="sm" opacity={0.8}>Nivå:</Text>
                        <Select
                          value={selectedCategoryId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSelectedCategoryId(v === "" ? null : v);
                            setSelectedGroupId(null); // nollställ grupp när nivå byts
                          }}
                          isDisabled={taxonomyLoading}
                          size="sm"
                          maxW="220px"
                          variant="outline"
                        >
                          <option value="">Alla</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </Select>
                      </HStack>
                    )}
                    {groups.length > 0 && (
                      <HStack>
                        <Text fontSize="sm" opacity={0.8}>Grupp:</Text>
                        <Select
                          value={selectedGroupId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSelectedGroupId(v === "" ? null : v);
                          }}
                          isDisabled={taxonomyLoading}
                          size="sm"
                          maxW="220px"
                          variant="outline"
                        >
                          <option value="">Alla</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </Select>
                      </HStack>
                    )}
                  </HStack>
                )}
                {/* Inline loading text for soft loading */}
                {softLoading && !tournamentTopError && (
                  <Text fontSize="xs" opacity={0.6} mt={1}>{fetchStatus || 'Hämtar…'}</Text>
                )}
                {/* ✨ ADD: visa om vi föll tillbaka till lägre värde än valt */}
                {usedMaxMatches != null && usedMaxMatches !== Number(matchDepth) && (
                  <Text fontSize="xs" opacity={0.6} mt={1}>
                    Använde <b>{usedMaxMatches}</b> matcher per spelare p.g.a. fallback/prestanda.
                    {(selectedCategoryId || selectedGroupId) ? " (filtrerat)" : ""}
                  </Text>
                )}
              </CardHeader>
              <Divider />
              <CardBody>
                {tournamentTopLoading ? (
                  <Stack spacing={3}>
                    {fetchStatus ? <Text fontSize="sm" opacity={0.7}>{fetchStatus}</Text> : <HStack><Spinner size="sm" /><Text>Hämtar topp 20…</Text></HStack>}
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={`sk-${i}`} variant="outline">
                          <CardHeader pb={2}>
                            <HStack>
                              <Box w="28px" h="24px" bg="gray.100" _dark={{ bg: 'gray.700' }} borderRadius="md" />
                              <Box flex="1">
                                <Box h="12px" bg="gray.100" _dark={{ bg: 'gray.700' }} borderRadius="md" mb={2} />
                                <Box h="10px" bg="gray.100" _dark={{ bg: 'gray.700' }} borderRadius="md" w="60%" />
                              </Box>
                            </HStack>
                          </CardHeader>
                          <CardBody pt={0}>
                            <HStack spacing={2}>
                              <Box h="20px" w="48px" bg="gray.100" _dark={{ bg: 'gray.700' }} borderRadius="md" />
                              <Box h="20px" w="68px" bg="gray.100" _dark={{ bg: 'gray.700' }} borderRadius="md" />
                              <Box h="20px" w="56px" bg="gray.100" _dark={{ bg: 'gray.700' }} borderRadius="md" />
                            </HStack>
                          </CardBody>
                        </Card>
                      ))}
                    </SimpleGrid>
                  </Stack>
                ) : tournamentTopError ? (
                  <Stack spacing={2}>
                    <Text color="red.500" whiteSpace="normal" wordBreak="break-word">
                      Fel: {tournamentTopError}
                    </Text>
                    <Text fontSize="xs" opacity={0.6}>
                      Förfrågan: {tournamentTopUrl}
                    </Text>
                    {/* ✨ ADD: visa senaste försökta maxMatches vid fel */}
                    {usedMaxMatches != null && (
                      <Text fontSize="xs" opacity={0.6}>
                        Senast försökt maxMatches: {usedMaxMatches}
                      </Text>
                    )}
                    <HStack>
                      <Button size="sm" onClick={triggerReload}>Försök igen</Button>
                      <Text fontSize="xs" opacity={0.6}>
                        Tips: Ladda om sidan om felet kvarstår.
                      </Text>
                    </HStack>
                  </Stack>
                ) : tournamentTopCombined.length === 0 ? (
                  <Text>Ingen poängdata att visa.</Text>
                ) : (
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    {tournamentTopCombined.slice(0, 20).map((p, idx) => (
                      <Card key={`${p.playerId || p.name}-${idx}`} variant="outline" cursor="pointer" onClick={() => setSelectedPlayer({ ...p, rank: idx + 1 })}>
                        <CardHeader pb={2}>
                          <HStack justify="space-between" align="center">
                            <HStack>
                              <Badge variant="subtle" colorScheme="purple" minW="28px" textAlign="center">{idx + 1}</Badge>
                              <Avatar name={p.name} size="sm" />
                              <Box>
                                <HStack spacing={2} align="center">
                                  <Text fontWeight="semibold" noOfLines={1} fontSize="md">{p.name || 'Okänd spelare'}</Text>
                                  {p.number ? (<Tag size="xs" colorScheme="gray"><TagLabel>#{p.number}</TagLabel></Tag>) : null}
                                </HStack>
                                <Text fontSize="xs" opacity={0.7} noOfLines={1}>{p.teamName || '—'}</Text>
                              </Box>
                            </HStack>
                            <Tag size="sm" colorScheme="purple" title={`${p.points ?? 0} p totalt • ${p.matchesCount ?? 0} matcher`}>
                              <TagLabel>{(p.avgPoints ?? p.points ?? 0)} p/sn</TagLabel>
                            </Tag>
                          </HStack>
                        </CardHeader>
                        <CardBody pt={0}>
                          <Stack spacing={2}>
                            <HStack spacing={2} flexWrap="wrap">
                              <Tag size="sm"><TagLabel>{Number(p.made3 ?? 0) || 0}×3p</TagLabel></Tag>
                              <Tag size="sm"><TagLabel>{Number(p.made2 ?? 0) || 0}×2p</TagLabel></Tag>
                              <Tag size="sm"><TagLabel>{Number(p.made1 ?? p.ft ?? 0) || 0}×1p</TagLabel></Tag>
                              <Tag size="sm"><TagLabel>Fouls: {Number(p.fouls ?? 0) || 0}</TagLabel></Tag>
                            </HStack>
                            <HStack spacing={2} flexWrap="wrap">
                              <Tag size="sm" colorScheme="purple" title="Totalpoäng"><TagLabel>{p.points ?? 0} p totalt</TagLabel></Tag>
                              <Tag size="sm" colorScheme="gray" title="Antal matcher"><TagLabel>{p.matchesCount ?? 0} matcher</TagLabel></Tag>
                              <Tag size="sm" title="Poängmix 3p/2p/1p"><TagLabel>{p.threeShare ?? 0}% • {p.twoShare ?? 0}% • {p.oneShare ?? 0}%</TagLabel></Tag>
                            </HStack>
                            {p.lastEventAt ? (
                              <Text fontSize="xs" opacity={0.6}>Senast aktiv: {new Date(p.lastEventAt).toLocaleString()}</Text>
                            ) : null}
                          </Stack>
                        </CardBody>
                      </Card>
                    ))}
                  </SimpleGrid>
                )}
              </CardBody>
            </Card>
          </TabPanel>

          {/* 2) Lagstatistik */}
          <TabPanel>
            {teams.length === 0 ? (
              <Text>Inga lag hittades.</Text>
            ) : (
              <Box>
                {teams.map((t, idxTeam) => (
                  <Card key={`${t.id ?? 'team'}-${idxTeam}`} variant="outline" borderRadius="lg" mb={3}>
                    <CardHeader>
                      <HStack justify="space-between">
                        <Heading as="h4" size="sm">{t.name}</Heading>
                        {t.seed != null && (
                          <Tag size="sm" colorScheme="purple">Seed {t.seed}</Tag>
                        )}
                      </HStack>
                    </CardHeader>
                    <CardBody pt={0}>
                      {t.players?.length ? (
                        <Stack spacing={1}>
                          {t.players.map((p, idxPlayer) => (
                             <HStack key={`${p?.id ?? p?.playerId ?? p?.globalPlayerId ?? p?.name ?? 'player'}-${idxPlayer}`} justify="space-between">
                              <HStack>
                                <Avatar name={p?.name || p?.fullName} size="xs" />
                                <Text>{p?.name || p?.fullName || "Okänd spelare"}</Text>
                              </HStack>
                            </HStack>
                          ))}
                        </Stack>
                      ) : (
                        <Text opacity={0.7}>Inga spelare listade</Text>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </Box>
            )}
          </TabPanel>

          {/* 3) Enskilda matcher */}
          <TabPanel overflow="visible">
            {matches.length === 0 ? (
              <Text>Inga matcher hittades.</Text>
            ) : (
              <Box>
                {/* Toppscorer for selected match */}
                <Card variant="outline" borderRadius="lg" mb={6}>
                  <CardHeader>
                    <Heading as="h3" size="md">Toppscorer – vald match</Heading>
                    <Text mt={1} opacity={0.8}>
                      {selected?.home} vs {selected?.away}{" "}
                      {(selectedScore || selected?.result) && `• ${selectedScore || selected?.result}`}
                    </Text>
                    {noEventData && (
                      <HStack mt={2}>
                        <Tag size="sm" colorScheme="gray">Inga matchhändelser rapporterade</Tag>
                      </HStack>
                    )}
                  </CardHeader>
                  <Divider />
                  <CardBody>
                    <Stack spacing={4} divider={<StackDivider />}> 
                      <Box>
                        <Text fontSize="sm" opacity={0.7} mb={1}>Hemmalag</Text>
                        {fetchingScorers ? (
                          <HStack><Spinner size="sm" /><Text>Laddar poäng…</Text></HStack>
                        ) : topScorers.home ? (
                          <HStack>
                            <Avatar name={topScorers.home.name} size="sm" />
                            <Text fontWeight="semibold">{topScorers.home.name}</Text>
                            <Tag size="sm" colorScheme="purple"><TagLabel>{topScorers.home.points} p</TagLabel></Tag>
                          </HStack>
                        ) : (
                          <Text>Ingen poängdata.</Text>
                        )}
                      </Box>
                      <Box>
                        <Text fontSize="sm" opacity={0.7} mb={1}>Bortalag</Text>
                        {fetchingScorers ? (
                          <HStack><Spinner size="sm" /><Text>Laddar poäng…</Text></HStack>
                        ) : topScorers.away ? (
                          <HStack>
                            <Avatar name={topScorers.away.name} size="sm" />
                            <Text fontWeight="semibold">{topScorers.away.name}</Text>
                            <Tag size="sm" colorScheme="purple"><TagLabel>{topScorers.away.points} p</TagLabel></Tag>
                          </HStack>
                        ) : (
                          <Text>Ingen poängdata.</Text>
                        )}
                      </Box>
                    </Stack>
                  </CardBody>
                  <CardFooter>
                    <Text fontSize="xs" opacity={0.6}>
                      Visar högst noterad poäng per lag (från matchhändelser eller boxscore).
                    </Text>
                  </CardFooter>
                </Card>

                {/* Matches grid with sticky pagination header */}
                <Box>
                  <HStack justify="space-between" mb={3} position="sticky" top={0} bg="white" _dark={{ bg: "gray.800" }} zIndex={1} py={2}>
                    <Text>
                      Totalt: {meta?.total ?? matches.length} • Sida {meta?.current_page ?? page} av {meta?.last_page ?? 1}
                    </Text>
                    <HStack>
                      <Button size="sm" onClick={() => setPage(1)} isDisabled={!canPrev}>« Första</Button>
                      <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} isDisabled={!canPrev}>‹ Föregående</Button>
                      <Button size="sm" onClick={() => setPage((p) => p + 1)} isDisabled={!canNext}>Nästa ›</Button>
                      <Button size="sm" onClick={() => setPage(meta?.last_page || page)} isDisabled={!canNext}>Sista »</Button>
                    </HStack>
                  </HStack>

                  <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
                    {matches.map((m, idxMatch) => {
                      const isActive = selected?.id?.toString() === m.id?.toString();
                      return (
                        <Card
                          key={`${m.id ?? 'match'}-${idxMatch}`}
                          variant={isActive ? "filled" : "outline"}
                          borderRadius="lg"
                          cursor="pointer"
                          onClick={() => setSelectedId(m.id)}
                        >
                          <CardHeader pb={2}>
                            <HStack justify="space-between">
                              <Text fontWeight="semibold">{m.home}</Text>
                              <Text opacity={0.7}>vs</Text>
                              <Text fontWeight="semibold" textAlign="right">{m.away}</Text>
                            </HStack>
                          </CardHeader>
                          <CardBody pt={0}>
                            <HStack justify="space-between">
                              <Tag size="sm" colorScheme="gray">ID {m.id}</Tag>
                              <Tag
                                size="sm"
                                colorScheme={(isActive && selectedScore) || m.result !== "—" ? "purple" : "gray"}
                              >
                                {isActive && selectedScore ? selectedScore : (m.result || "—")}
                              </Tag>
                            </HStack>
                            <Text mt={2} fontSize="sm" opacity={0.8}>
                              {m.date ? new Date(m.date).toLocaleString() : ""}
                            </Text>
                          </CardBody>
                        </Card>
                      );
                    })}
                  </SimpleGrid>
                </Box>
              </Box>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
      {/* Player detail modal */}
      <Modal isOpen={!!selectedPlayer} onClose={() => setSelectedPlayer(null)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedPlayer ? (
              <HStack justify="space-between" align="center">
                <HStack>
                  <Badge colorScheme="purple">#{selectedPlayer.rank}</Badge>
                  <Avatar name={selectedPlayer.name} size="sm" />
                  <Box>
                    <Text fontWeight="semibold">{selectedPlayer.name}</Text>
                    <Text fontSize="sm" opacity={0.8}>{selectedPlayer.teamName || '—'}{selectedPlayer.number ? ` • #${selectedPlayer.number}` : ''}</Text>
                  </Box>
                </HStack>
                <HStack spacing={2}>
                  <Tag colorScheme="purple" title={`${selectedPlayer.points ?? 0} p totalt / ${selectedPlayer.matchesCount ?? 0} matcher`}>
                    <TagLabel>{(selectedPlayer.avgPoints ?? selectedPlayer.points ?? 0)} p/sn</TagLabel>
                  </Tag>
                  <Tag colorScheme="gray">
                    <TagLabel>{selectedPlayer.points ?? 0} p</TagLabel>
                  </Tag>
                </HStack>
              </HStack>
            ) : null}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedPlayer && (
              <Stack spacing={4}>
                <HStack spacing={2} flexWrap="wrap">
                  <Tag size="sm"><TagLabel>{Number(selectedPlayer.made3 ?? 0) || 0}×3p</TagLabel></Tag>
                  <Tag size="sm"><TagLabel>{Number(selectedPlayer.made2 ?? 0) || 0}×2p</TagLabel></Tag>
                  <Tag size="sm"><TagLabel>{Number(selectedPlayer.made1 ?? selectedPlayer.ft ?? 0) || 0}×1p</TagLabel></Tag>
                  <Tag size="sm"><TagLabel>Fouls: {Number(selectedPlayer.fouls ?? 0) || 0}</TagLabel></Tag>
                </HStack>

                {/* Period points */}
                {selectedPlayer.periodPoints && Object.keys(selectedPlayer.periodPoints).length ? (
                  <Box>
                    <Text fontWeight="semibold" mb={1}>Poäng per period</Text>
                    <HStack spacing={2} flexWrap="wrap">
                      {Object.entries(selectedPlayer.periodPoints).map(([per, val]) => (
                        <Tag key={per} size="sm"><TagLabel>P{per}: {val}</TagLabel></Tag>
                      ))}
                    </HStack>
                  </Box>
                ) : null}

                {/* Matches list */}
                {Array.isArray(selectedPlayer.matches) && selectedPlayer.matches.length ? (
                  <Box>
                    <Text fontWeight="semibold" mb={1}>Matcher</Text>
                    <HStack spacing={2} flexWrap="wrap">
                      {selectedPlayer.matches.map((mid) => (
                        <Tag key={mid} size="sm" colorScheme="gray"><TagLabel>ID {mid}</TagLabel></Tag>
                      ))}
                    </HStack>
                  </Box>
                ) : null}
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setSelectedPlayer(null)}>Stäng</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}