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
  Grid,
  GridItem,
  Avatar,
  Tag,
  TagLabel,
  Divider,
} from "@chakra-ui/react";
import {
  useProfixioTournamentMatches,
  useProfixioTournamentTeams,
} from "../../hooks/useProfixio";
import { getMatchEvents, getMatchLineup } from "../../api/profixioApi";
import useAuth from "../../hooks/useAuth";

// --- helpers -------------------------------------------------------------

const normalizeMatches = (raw) => {
  const list = Array.isArray(raw) ? raw : raw?.data || [];

  const pickTeamName = (...candidates) => {
    for (const c of candidates) {
      if (!c) continue;
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (typeof c === 'object') {
        const v = c?.name || c?.team || c?.teamName || c?.displayName;
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }
    return '—';
  };

  const readScore = (m, side) => {
    const s = side; // 'home' | 'away'
    // 1) direct numeric fields
    const direct =
      m?.[`${s}Score`] ?? m?.[`${s}_score`] ??
      m?.[`${s}Goals`] ?? m?.[`${s}_goals`] ??
      m?.[`${s}Points`] ?? m?.[`${s}_points`] ??
      m?.[`${s}Result`] ?? m?.[`${s}_result`] ??
      m?.[`result_${s}`] ?? m?.[`score_${s}`] ?? m?.[`goals_${s}`];
    if (typeof direct === 'number') return direct;
    if (typeof direct === 'string' && direct.trim() && !isNaN(Number(direct))) return Number(direct);

    // 2) nested team object variants
    const teams = m?.teams || m?.team || {};
    const sideObj = (s === 'home' ? teams.home : teams.away) || (Array.isArray(teams) ? teams.find(t => (t.side || t.location || '').toString().toLowerCase().includes(s)) : null);
    const fromSide = sideObj?.goals ?? sideObj?.score ?? sideObj?.points ?? sideObj?.result ?? sideObj?.[`${s}Score`];
    if (typeof fromSide === 'number') return fromSide;
    if (typeof fromSide === 'string' && fromSide.trim() && !isNaN(Number(fromSide))) return Number(fromSide);

    // 3) score string like "67-54" or "67–54"
    const resStr = (m?.result || m?.score || m?.final || '').toString();
    if (resStr.includes('-') || resStr.includes('–')) {
      const sep = resStr.includes('–') ? '–' : '-';
      const [h, a] = resStr.split(sep).map(x => Number(String(x).trim()));
      if (!Number.isNaN(h) && !Number.isNaN(a)) return s === 'home' ? h : a;
    }

    // 4) object { home, away }
    const fromObj = m?.score || m?.scores || m?.resultObj || {};
    const cand = fromObj?.[s];
    if (typeof cand === 'number') return cand;
    if (typeof cand === 'string' && cand.trim() && !isNaN(Number(cand))) return Number(cand);

    return null;
  };

  return list.map((m) => {
    const homeName = pickTeamName(m?.homeTeamName, m?.homeTeam, m?.home?.name, m?.home, m?.teams?.home?.team, m?.teams?.home?.name, m?.teams?.home);
    const awayName = pickTeamName(m?.awayTeamName, m?.awayTeam, m?.away?.name, m?.away, m?.teams?.away?.team, m?.teams?.away?.name, m?.teams?.away);

    const hs = readScore(m, 'home');
    const as = readScore(m, 'away');

    let result = '—';
    if (hs != null && as != null) result = `${hs}–${as}`;
    else if (typeof m?.result === 'string' && m.result.trim()) result = m.result.replace('-', '–');
    else if (typeof m?.score === 'string' && m.score.trim()) result = m.score.replace('-', '–');

    return {
      id: m?.id ?? m?.matchId ?? m?.code,
      home: homeName,
      away: awayName,
      result,
      date: m?.start ?? m?.date ?? m?.startDate ?? m?.gameTime ?? m?.played_at ?? null,
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

// Try to extract points from a generic event
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

// --- component -----------------------------------------------------------

export default function TournamentDetails() {
  const { tournamentId } = useParams();
  const { user } = useAuth();

  // Stable bearer value for effects
  const bearer = useMemo(
    () => user?.accessToken ?? user?.idToken ?? null,
    [user?.accessToken, user?.idToken]
  );

  // pagination for matches
  const [page, setPage] = useState(1);
  const limit = 15;

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

  // Selected match
  const [selectedId, setSelectedId] = useState(null);
  const selected = useMemo(
    () =>
      matches.find(
        (m) => m.id?.toString() === selectedId?.toString()
      ) || matches[0],
    [matches, selectedId]
  );

  // Top scorers (home/away)
  const [topScorers, setTopScorers] = useState({ home: null, away: null });
  const [fetchingScorers, setFetchingScorers] = useState(false);

  // Quick lookup: team name -> players[]
  const teamPlayersByName = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => map.set(t.name, t.players || []));
    return map;
  }, [teams]);

  useEffect(() => {
    const token = bearer;
    if (!token || !tournamentId || !selected?.id) return;

    let cancelled = false;
    const run = async () => {
      try {
        setFetchingScorers(true);

        const [lineupRes, eventsRes] = await Promise.all([
          getMatchLineup(tournamentId, selected.id, token),
          getMatchEvents(tournamentId, selected.id, token),
        ]);

        const lineupList = Array.isArray(lineupRes?.data)
          ? lineupRes.data
          : lineupRes || [];
        const playerMeta = new Map();
        lineupList.forEach((p) => {
          const id =
            p?.id || p?.playerId || p?.globalPlayerId || p?.number;
          const name = p?.name || p?.fullName || p?.displayName;
          const side = (p?.teamSide || p?.side || "")
            .toString()
            .toLowerCase()
            .includes("away")
            ? "away"
            : "home";
          if (id != null) playerMeta.set(id.toString(), { name, side });
        });

        const events = Array.isArray(eventsRes?.data)
          ? eventsRes.data
          : eventsRes || [];
        const tally = new Map();
        events.forEach((ev) => {
          const typeRaw = (ev.type || ev.eventType || ev.event || ev.code || '').toString().toLowerCase();
          const pts = getPointsFromEvent({ ...ev, type: typeRaw });
          if (!pts) return;
          const pid = ev.playerId || ev.player || ev.globalPlayerId || ev.personId;
          if (pid == null) return;
          const key = pid.toString();
          tally.set(key, (tally.get(key) || 0) + pts);
        });

        const pickTop = (side) => {
          let top = { name: "Okänd spelare", points: 0 };

          playerMeta.forEach((meta, pid) => {
            if (meta.side !== side) return;
            const pts = tally.get(pid) || 0;
            if (pts > top.points) top = { name: meta.name || "Okänd spelare", points: pts };
          });

          if (top.points === 0) {
            const roster =
              teamPlayersByName.get(side === "home" ? selected?.home : selected?.away) ||
              [];
            roster.forEach((p) => {
              const pid = p?.id || p?.playerId || p?.globalPlayerId;
              const pts = pid != null ? tally.get(pid?.toString()) || 0 : 0;
              const nm = p?.name || p?.fullName || "Okänd spelare";
              if (pts > top.points) top = { name: nm, points: pts };
            });
          }

          return top;
        };

        const result = { home: pickTop("home"), away: pickTop("away") };
        if (!cancelled) setTopScorers(result);
      } catch (e) {
        if (!cancelled) setTopScorers({ home: null, away: null });
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

  // Ensure we always have a selected card
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
      <Box
        display="flex"
        alignItems="baseline"
        justifyContent="space-between"
        mb={4}
      >
        <Heading as="h1" size="lg">
          Turnering {tournamentId}
        </Heading>
        <Badge variant="subtle" colorScheme="purple">
          ID: {tournamentId}
        </Badge>
      </Box>

      <Tabs colorScheme="purple" variant="enclosed">
        <TabList>
          <Tab>Matcher</Tab>
          <Tab>Lag &amp; spelare</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            {matches.length === 0 ? (
              <Text>Inga matcher hittades.</Text>
            ) : (
              <>
                <HStack justify="space-between" mb={3}>
                  <Text>
                    Totalt: {meta?.total ?? matches.length} • Sida{" "}
                    {meta?.current_page ?? page} av {meta?.last_page ?? 1}
                  </Text>
                  <HStack>
                    <Button
                      size="sm"
                      onClick={() => setPage(1)}
                      isDisabled={!canPrev}
                    >
                      « Första
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      isDisabled={!canPrev}
                    >
                      ‹ Föregående
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      isDisabled={!canNext}
                    >
                      Nästa ›
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setPage(meta?.last_page || page)}
                      isDisabled={!canNext}
                    >
                      Sista »
                    </Button>
                  </HStack>
                </HStack>

                {/* NBA-style: left = top scorers, right = match cards grid */}
                <Grid
                  templateColumns={{ base: "1fr", lg: "360px 1fr" }}
                  gap={6}
                  alignItems="start"
                >
                  <GridItem>
                    <Card variant="outline" borderRadius="lg">
                      <CardHeader>
                        <Heading as="h3" size="md">
                          Toppscorer – vald match
                        </Heading>
                        <Text mt={1} opacity={0.8}>
                          {selected?.home} vs {selected?.away}{" "}
                          {selected?.result && `• ${selected.result}`}
                        </Text>
                      </CardHeader>
                      <Divider />
                      <CardBody>
                        <Stack spacing={4} divider={<StackDivider />}>
                          <Box>
                            <Text fontSize="sm" opacity={0.7} mb={1}>
                              Hemmalag
                            </Text>
                            {fetchingScorers ? (
                              <HStack>
                                <Spinner size="sm" />
                                <Text>Laddar poäng…</Text>
                              </HStack>
                            ) : topScorers.home ? (
                              <HStack>
                                <Avatar
                                  name={topScorers.home.name}
                                  size="sm"
                                />
                                <Text fontWeight="semibold">
                                  {topScorers.home.name}
                                </Text>
                                <Tag size="sm" colorScheme="purple">
                                  <TagLabel>{topScorers.home.points} p</TagLabel>
                                </Tag>
                              </HStack>
                            ) : (
                              <Text>Ingen poängdata.</Text>
                            )}
                          </Box>
                          <Box>
                            <Text fontSize="sm" opacity={0.7} mb={1}>
                              Bortalag
                            </Text>
                            {fetchingScorers ? (
                              <HStack>
                                <Spinner size="sm" />
                                <Text>Laddar poäng…</Text>
                              </HStack>
                            ) : topScorers.away ? (
                              <HStack>
                                <Avatar
                                  name={topScorers.away.name}
                                  size="sm"
                                />
                                <Text fontWeight="semibold">
                                  {topScorers.away.name}
                                </Text>
                                <Tag size="sm" colorScheme="purple">
                                  <TagLabel>{topScorers.away.points} p</TagLabel>
                                </Tag>
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
                  </GridItem>

                  <GridItem>
                    <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
                      {matches.map((m) => {
                        const isActive =
                          selected?.id?.toString() === m.id?.toString();
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
                                <Text
                                  fontWeight="semibold"
                                  textAlign="right"
                                >
                                  {m.away}
                                </Text>
                              </HStack>
                            </CardHeader>
                            <CardBody pt={0}>
                              <HStack justify="space-between">
                                <Tag size="sm" colorScheme="gray">
                                  ID {m.id}
                                </Tag>
                                <Tag
                                  size="sm"
                                  colorScheme={
                                    m.result !== "—" ? "purple" : "gray"
                                  }
                                >
                                  {m.result || "—"}
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
                  </GridItem>
                </Grid>
              </>
            )}
          </TabPanel>

          <TabPanel>
            {teams.length === 0 ? (
              <Text>Inga lag hittades.</Text>
            ) : (
              <Box>
                {teams.map((t) => (
                  <Card key={t.id} variant="outline" borderRadius="lg" mb={3}>
                    <CardHeader>
                      <HStack justify="space-between">
                        <Heading as="h4" size="sm">
                          {t.name}
                        </Heading>
                        {t.seed != null && (
                          <Tag size="sm" colorScheme="purple">
                            Seed {t.seed}
                          </Tag>
                        )}
                      </HStack>
                    </CardHeader>
                    <CardBody pt={0}>
                      {t.players?.length ? (
                        <Stack spacing={1}>
                          {t.players.map((p) => (
                            <HStack
                              key={p?.id || p?.playerId || p?.name}
                              justify="space-between"
                            >
                              <HStack>
                                <Avatar name={p?.name || p?.fullName} size="xs" />
                                <Text>
                                  {p?.name || p?.fullName || "Okänd spelare"}
                                </Text>
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
        </TabPanels>
      </Tabs>
    </Box>
  );
}