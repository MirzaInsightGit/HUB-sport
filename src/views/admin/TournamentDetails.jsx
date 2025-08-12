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

/* ----------------------------- helpers ----------------------------- */

// Safely pick a printable team name from mixed API shapes
const pickTeamName = (...candidates) => {
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "string" && c.trim()) return c;
    if (typeof c === "object") {
      const n = c.name || c.teamName || c.displayName || c.shortName;
      if (n && typeof n === "string" && n.trim()) return n;
    }
  }
  return "—";
};

const normalizeMatches = (raw) => {
  const list = Array.isArray(raw) ? raw : raw?.data || [];

  const readScore = (m, side) => {
    // Try a variety of common shapes
    const teams = m?.teams || {};
    const sideObj =
      (side === "home" ? teams.home : teams.away) ||
      (Array.isArray(teams)
        ? teams.find((t) =>
            (t.side || t.teamSide || "").toString().toLowerCase().includes(side)
          )
        : null);

    return (
      m?.[`${side}Score`] ??
      m?.[`${side}_score`] ??
      m?.[`result${side[0].toUpperCase()}${side.slice(1)}`] ??
      m?.[`${side}Goals`] ??
      m?.[`${side}_goals`] ??
      sideObj?.goals ??
      sideObj?.score ??
      m?.score?.[side] ??
      null
    );
  };

  return list.map((m) => {
    const homeName = pickTeamName(
      m?.homeTeamName,
      m?.homeTeam,
      m?.home,
      m?.home?.team,
      m?.teams?.home?.team,
      m?.teams?.home?.name,
      m?.teams?.home
    );
    const awayName = pickTeamName(
      m?.awayTeamName,
      m?.awayTeam,
      m?.away,
      m?.away?.team,
      m?.teams?.away?.team,
      m?.teams?.away?.name,
      m?.teams?.away
    );

    const hs = readScore(m, "home");
    const as = readScore(m, "away");

    return {
      id: m?.id ?? m?.matchId ?? m?.code,
      home: homeName,
      away: awayName,
      result:
        hs != null && as != null
          ? `${hs}–${as}`
          : typeof m?.result === "string"
          ? m.result
          : "—",
      date: m?.start ?? m?.date ?? m?.startDate ?? m?.gameTime ?? null,
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

// Försöker extrahera poäng ur ett generiskt event
const getPointsFromEvent = (ev) => {
  if (!ev) return 0;
  if (typeof ev.points === "number") return ev.points;
  if (typeof ev.value === "number") return ev.value;
  if (typeof ev.score === "number") return ev.score;

  const t = (ev.type || ev.eventType || ev.code || "")
    .toString()
    .toLowerCase();

  if (t.includes("3pt") || t.includes("3-po") || t.includes("trepo")) return 3;
  if (t.includes("2pt") || t.includes("2-po")) return 2;
  if (t.includes("1pt") || t.includes("ft") || t.includes("straff")) return 1;

  return 0;
};

/* ----------------------------- component ----------------------------- */

export default function TournamentDetails() {
  const { tournamentId } = useParams();
  const { user } = useAuth();

  // pagination
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

  // vald match (driver vänsterpanelen)
  const [selectedId, setSelectedId] = useState(null);
  const selected = useMemo(
    () =>
      matches.find((m) => m.id?.toString() === selectedId?.toString()) ||
      matches[0],
    [matches, selectedId]
  );

  // toppscorer (hemma/borta)
  const [topScorers, setTopScorers] = useState({ home: null, away: null });
  const [fetchingScorers, setFetchingScorers] = useState(false);

  // snabb‑lookup: lagnamn -> players[]
  const teamPlayersByName = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => map.set(t.name, t.players || []));
    return map;
  }, [teams]);

  // hämta & beräkna toppscorer för vald match
  useEffect(() => {
    if (!user?.idToken || !tournamentId || !selected?.id) return;

    let cancelled = false;
    const run = async () => {
      try {
        setFetchingScorers(true);

        // --- helpers for many API shapes ---
        const normalizeLineup = (res) => {
          // already an array?
          if (Array.isArray(res)) return res;

          // common wrapper { data: [...] }
          if (Array.isArray(res?.data)) return res.data;

          // shape { home: [...], away: [...] }
          if (Array.isArray(res?.home) || Array.isArray(res?.away)) {
            const out = [];
            (res.home || []).forEach((p) =>
              out.push({ ...p, teamSide: "home" })
            );
            (res.away || []).forEach((p) =>
              out.push({ ...p, teamSide: "away" })
            );
            return out;
          }

          // shape { teams: [{ side, players: [] }, ...] }
          if (Array.isArray(res?.teams)) {
            const out = [];
            res.teams.forEach((t) => {
              (t.players || []).forEach((p) =>
                out.push({ ...p, teamSide: t.side || t.teamSide })
              );
            });
            return out;
          }

          return [];
        };

        const normalizeEvents = (res) => {
          if (Array.isArray(res)) return res;
          if (Array.isArray(res?.data)) return res.data;
          if (Array.isArray(res?.events)) return res.events;
          if (Array.isArray(res?.data?.data)) return res.data.data;
          return [];
        };

        const [lineupRes, eventsRes] = await Promise.all([
          getMatchLineup(tournamentId, selected.id, user.idToken),
          getMatchEvents(tournamentId, selected.id, user.idToken),
        ]);

        const lineupList = normalizeLineup(lineupRes);
        const events = normalizeEvents(eventsRes);

        const playerMeta = new Map();
        lineupList.forEach((p) => {
          const id =
            p?.id ??
            p?.playerId ??
            p?.globalPlayerId ??
            p?.personId ??
            p?.number;
          const name =
            p?.name ||
            p?.fullName ||
            p?.displayName ||
            [p?.firstName, p?.lastName].filter(Boolean).join(" ") ||
            `#${p?.number || "?"}`;
          const sideRaw = (p?.teamSide || p?.side || p?.team || "")
            .toString()
            .toLowerCase();
          const side = sideRaw.includes("away") || sideRaw === "borta" ? "away" : "home";
          if (id != null) playerMeta.set(id.toString(), { name, side });
        });

        const tally = new Map();
        events.forEach((ev) => {
          const pts = getPointsFromEvent(ev);
          if (!pts) return;
          const pid =
            ev.playerId ??
            ev.player ??
            ev.globalPlayerId ??
            ev.personId ??
            ev.player_id ??
            ev.person_id;
          if (pid == null) return;
          const key = pid.toString();
          tally.set(key, (tally.get(key) || 0) + pts);
        });

        const pickTop = (side) => {
          let top = { name: "Okänd spelare", points: 0 };

          playerMeta.forEach((meta, pid) => {
            if (meta.side !== side) return;
            const pts = tally.get(pid) || 0;
            if (pts > top.points) {
              top = { name: meta.name || "Okänd spelare", points: pts };
            }
          });

          // fallback till trupp om event saknar namn/id
          if (top.points === 0) {
            const roster =
              teamPlayersByName.get(
                side === "home" ? selected?.home : selected?.away
              ) || [];
            roster.forEach((p) => {
              const pid = p?.id || p?.playerId || p?.globalPlayerId;
              const pts = pid != null ? tally.get(pid?.toString()) || 0 : 0;
              const nm =
                p?.name ||
                p?.fullName ||
                p?.displayName ||
                [p?.firstName, p?.lastName].filter(Boolean).join(" ") ||
                "Okänd spelare";
              if (pts > top.points) top = { name: nm, points: pts };
            });
          }

          return top;
        };

        const result = { home: pickTop("home"), away: pickTop("away") };
        if (!cancelled) setTopScorers(result);
      } catch {
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
    user?.idToken,
    tournamentId,
    selected?.id,
    selected?.home,
    selected?.away,
    teamPlayersByName,
  ]);

  // se till att något kort alltid är valt
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

                {/* NBA-style: vänster toppscorer, höger grid med matcher */}
                <Grid templateColumns={{ base: "1fr", lg: "360px 1fr" }} gap={6} alignItems="start">
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
                              <HStack><Spinner size="sm" /><Text>Laddar poäng…</Text></HStack>
                            ) : topScorers.home ? (
                              <HStack>
                                <Avatar name={topScorers.home.name} size="sm" />
                                <Text fontWeight="semibold">{topScorers.home.name}</Text>
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
                              <HStack><Spinner size="sm" /><Text>Laddar poäng…</Text></HStack>
                            ) : topScorers.away ? (
                              <HStack>
                                <Avatar name={topScorers.away.name} size="sm" />
                                <Text fontWeight="semibold">{topScorers.away.name}</Text>
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
                          Visar högst noterad poäng per lag (beräknad från matchhändelser).
                        </Text>
                      </CardFooter>
                    </Card>
                  </GridItem>

                  <GridItem>
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
                                <Text fontWeight="semibold" textAlign="right">
                                  {m.away}
                                </Text>
                              </HStack>
                            </CardHeader>
                            <CardBody pt={0}>
                              <HStack justify="space-between">
                                <Tag size="sm" colorScheme="gray">ID {m.id}</Tag>
                                <Tag size="sm" colorScheme={m.result !== "—" ? "purple" : "gray"}>
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
        </TabPanels>
      </Tabs>
    </Box>
  );
}