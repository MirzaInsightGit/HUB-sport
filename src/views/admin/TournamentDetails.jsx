// src/views/admin/TournamentDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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
} from "../../api/profixioApi";
import useAuth from "../../hooks/useAuth";

/* ---------------- helpers ---------------- */

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
  const { user } = useAuth();

  // Memoiserad bearer för ESLint + stabil deps
  const bearer = useMemo(
    () => user?.accessToken ?? user?.idToken ?? null,
    [user?.accessToken, user?.idToken]
  );

  // pagination
  const [page, setPage] = useState(1);
  const limit = 100;

  const { data: rawMatches, loading: mLoading } =
    useProfixioTournamentMatches(tournamentId, { page, limit });
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
  // Memoized: combine duplicate players by stable key and compute per-game avg + mix
  const tournamentTopCombined = useMemo(() => {
    if (!Array.isArray(tournamentTop)) return [];

    // Normalize player name to a stable slug without diacritics/punctuation
    const normalizeName = (name) => {
      return String(name || "")
        .normalize("NFD").replace(/\p{Diacritic}+/gu, "")
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
  // Fetch top 20 scorers for the whole tournament
  useEffect(() => {
    if (!tournamentId) return;
    let aborted = false;

    const API_BASE =
      (typeof window !== 'undefined' && window.__HUB_API_BASE__) ||
      process.env.REACT_APP_API_BASE ||
      process.env.VITE_API_BASE ||
      'http://localhost:8080';

    const safeJson = async (res) => {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return res.json();
      const text = await res.text();
      // try JSON anyway
      try { return JSON.parse(text); } catch (_) {}
      const snippet = text.slice(0, 140).replace(/\n/g, ' ');
      throw new Error(`Oväntat svar (status ${res.status}): ${snippet}`);
    };

    const run = async () => {
      try {
        setTournamentTopLoading(true);
        setTournamentTopError(null);
        // Hämta stort tak och aggregera i UI (undviker dubbletter av samma spelare)
        const url = `${API_BASE}/stats/top-scorers-from-tournament?tournamentId=${encodeURIComponent(tournamentId)}&limit=9999`;
        setTournamentTopUrl(url);

        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
          // still try to read body for better error
          try {
            const errBody = await res.text();
            const snippet = errBody.slice(0, 140).replace(/\n/g, ' ');
            throw new Error(`HTTP ${res.status}: ${snippet}`);
          } catch (e) {
            throw new Error(`HTTP ${res.status}`);
          }
        }
        const json = await safeJson(res);

        const items = Array.isArray(json?.items) ? json.items : [];
        if (!aborted) setTournamentTop(items);
      } catch (err) {
        if (!aborted) {
          setTournamentTop([]);
          setTournamentTopError(err?.message ? String(err.message) : 'Kunde inte hämta toppscorers.');
        }
      } finally {
        if (!aborted) setTournamentTopLoading(false);
      }
    };

    run();
    return () => {
      aborted = true;
    };
  }, [tournamentId]);

  // Team name -> players[]
  const teamPlayersByName = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => map.set(t.name, t.players || []));
    return map;
  }, [teams]);

  useEffect(() => {
    if (!bearer || !tournamentId || !selected?.id) return;

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
        <Spinner /> <Text>Laddar turneringsdata…</Text>
      </Box>
    );
  }

  return (
    <Box p={5}>
      <Box display="flex" alignItems="baseline" justifyContent="space-between" mb={4}>
        <Heading as="h1" size="lg">Turnering {tournamentId}</Heading>
        <Badge variant="subtle" colorScheme="purple">ID: {tournamentId}</Badge>
      </Box>

      <Tabs colorScheme="purple" variant="enclosed">
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
                <Text mt={1} opacity={0.8}>Summerat över alla matcher i turneringen {tournamentId}</Text>
              </CardHeader>
              <Divider />
              <CardBody>
                {tournamentTopLoading ? (
                  <HStack><Spinner size="sm" /><Text>Hämtar topp 20…</Text></HStack>
                ) : tournamentTopError ? (
                  <Stack spacing={1}>
                    <Text color="red.500" whiteSpace="normal" wordBreak="break-word">Fel: {tournamentTopError}</Text>
                    <Text fontSize="xs" opacity={0.6}>Förfrågan: {tournamentTopUrl}</Text>
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
                            <HStack spacing={2} wrap="wrap">
                              <Tag size="sm"><TagLabel>{Number(p.made3 ?? 0) || 0}×3p</TagLabel></Tag>
                              <Tag size="sm"><TagLabel>{Number(p.made2 ?? 0) || 0}×2p</TagLabel></Tag>
                              <Tag size="sm"><TagLabel>{Number(p.made1 ?? p.ft ?? 0) || 0}×1p</TagLabel></Tag>
                              <Tag size="sm"><TagLabel>Fouls: {Number(p.fouls ?? 0) || 0}</TagLabel></Tag>
                            </HStack>
                            <HStack spacing={2} wrap="wrap">
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
                {teams.map((t) => (
                  <Card key={t.id} variant="outline" borderRadius="lg" mb={3}>
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
                          {t.players.map((p) => (
                            <HStack key={p?.id || p?.playerId || p?.name} justify="space-between">
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
                    {matches.map((m) => {
                      const isActive = selected?.id?.toString() === m.id?.toString();
                      return (
                        <Card
                          key={m.id}
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
                <HStack spacing={2} wrap="wrap">
                  <Tag size="sm"><TagLabel>{Number(selectedPlayer.made3 ?? 0) || 0}×3p</TagLabel></Tag>
                  <Tag size="sm"><TagLabel>{Number(selectedPlayer.made2 ?? 0) || 0}×2p</TagLabel></Tag>
                  <Tag size="sm"><TagLabel>{Number(selectedPlayer.made1 ?? selectedPlayer.ft ?? 0) || 0}×1p</TagLabel></Tag>
                  <Tag size="sm"><TagLabel>Fouls: {Number(selectedPlayer.fouls ?? 0) || 0}</TagLabel></Tag>
                </HStack>

                {/* Period points */}
                {selectedPlayer.periodPoints && Object.keys(selectedPlayer.periodPoints).length ? (
                  <Box>
                    <Text fontWeight="semibold" mb={1}>Poäng per period</Text>
                    <HStack spacing={2} wrap="wrap">
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
                    <HStack spacing={2} wrap="wrap">
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