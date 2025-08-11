import React, { useMemo, useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  SimpleGrid,
  Badge,
  Divider,
} from "@chakra-ui/react";
import useAuth from "../../hooks/useAuth";
import { getMatchEvents, getMatchLineup } from "../../api/profixioApi";

// --- Helpers ---------------------------------------------------------------
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function coalesceEvents(raw) {
  // Profixio svar varierar ([], {data: []}, {data: {data: []}})
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (raw.data && Array.isArray(raw.data.data)) return raw.data.data;
  return [];
}

function coalesceLineup(raw) {
  if (!raw) return null;
  const d = raw.data || raw;
  return {
    homeTeam: d.homeTeam || d.home_team || d.home?.team || {},
    awayTeam: d.awayTeam || d.away_team || d.away?.team || {},
    homePlayers:
      d.homePlayers || d.home_players || d.home?.players || d.home?.lineup || [],
    awayPlayers:
      d.awayPlayers || d.away_players || d.away?.players || d.away?.lineup || [],
  };
}

function playerNameFrom(ev) {
  const p = ev.player || ev.person || {};
  const first = p.firstName || p.firstname || ev.firstName;
  const last = p.lastName || p.lastname || ev.lastName;
  const full = [first, last].filter(Boolean).join(" ");
  return (
    ev.playerName || ev.player_name || p.name || full || ev.personName || "Okänd spelare"
  );
}

function pointsFrom(ev) {
  // 1) direkta fält
  const direct = ev.points ?? ev.point ?? ev.value ?? ev.score?.points;
  if (typeof direct === "number") return direct;

  // 2) Försök tolka från strängar
  const t = String(ev.type || ev.eventType || ev.action || ev.description || "").toLowerCase();
  if (/3\s*poa|3p|trepo|3-pointer|3 point/.test(t)) return 3;
  if (/2\s*poa|2p|layup|dunk|tvåpoäng/.test(t)) return 2;
  if (/1\s*poa|straff|bonus|free throw|ft/.test(t)) return 1;

  // 3) Om texten innehåller "poäng" och startar med siffra
  const m = t.match(/(\d+)/);
  if (m) return Number(m[1]);

  return 0;
}

// --- Data hook ------------------------------------------------------------
function useMatchData(tournamentId, matchId) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [lineup, setLineup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [ev, lu] = await Promise.all([
          getMatchEvents(tournamentId, matchId, user.idToken),
          getMatchLineup(tournamentId, matchId, user.idToken),
        ]);
        if (cancelled) return;
        setEvents(coalesceEvents(ev));
        setLineup(coalesceLineup(lu));
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (user?.idToken && tournamentId && matchId) run();
    return () => {
      cancelled = true;
    };
  }, [user?.idToken, tournamentId, matchId]);

  return { events, lineup, loading, error };
}

// --- Component ------------------------------------------------------------
export default function MatchDetails() {
  const { tournamentId, matchId } = useParams();
  const { events, lineup, loading, error } = useMatchData(tournamentId, matchId);

  // Aggregera poäng per spelare
  const perPlayer = useMemo(() => {
    const map = new Map();
    for (const ev of asArray(events)) {
      const pid = ev.playerId || ev.player_id || ev.player?.id || ev.person?.id;
      const name = playerNameFrom(ev);
      const pts = pointsFrom(ev);
      const key = pid || name;
      if (!key) continue;
      const prev = map.get(key) || { id: pid, name, points: 0, events: [] };
      prev.points += pts;
      prev.events.push(ev);
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.points - a.points);
  }, [events]);

  if (loading) return <Box p={5}>Laddar match…</Box>;
  if (error)
    return (
      <Box p={5} color="crimson">
        Fel vid hämtning: {String(error?.message || error)}
      </Box>
    );

  const teams = lineup || {};

  return (
    <Box p={5}>
      <Heading size="lg" mb={1}>
        Match {matchId}
      </Heading>
      <Text mb={4}>
        <Link to={`/admin/tournaments/${tournamentId}`}>← Tillbaka till turnering</Link>
      </Text>

      {(teams.homeTeam?.name || teams.awayTeam?.name) && (
        <Text mb={6} fontWeight={600}>
          {teams.homeTeam?.name || "Hemma"} vs {teams.awayTeam?.name || "Borta"}
        </Text>
      )}

      <Heading size="md" mb={2}>
        Poäng per spelare
      </Heading>
      {perPlayer.length === 0 ? (
        <Text mb={6} opacity={0.7}>
          Inga händelser med poäng hittades.
        </Text>
      ) : (
        <Table variant="simple" mb={8} size="sm">
          <Thead>
            <Tr>
              <Th>Spelare</Th>
              <Th isNumeric>Poäng</Th>
            </Tr>
          </Thead>
          <Tbody>
            {perPlayer.map((p) => (
              <Tr key={p.id || p.name}>
                <Td>{p.name}</Td>
                <Td isNumeric>{p.points}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Divider my={6} />

      <Heading size="md" mb={2}>
        Händelser (rådata)
      </Heading>
      <Table variant="simple" size="sm">
        <Thead>
          <Tr>
            <Th>Tid</Th>
            <Th>Typ</Th>
            <Th>Spelare</Th>
            <Th isNumeric>Poäng</Th>
          </Tr>
        </Thead>
        <Tbody>
          {asArray(events).map((ev, i) => (
            <Tr key={i}>
              <Td>{ev.time || ev.timestamp || ev.createdAt || "-"}</Td>
              <Td>
                {ev.type || ev.eventType || ev.action || ev.description || "-"}
              </Td>
              <Td>{playerNameFrom(ev)}</Td>
              <Td isNumeric>{pointsFrom(ev)}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {teams.homePlayers?.length || teams.awayPlayers?.length ? (
        <>
          <Divider my={6} />
          <Heading size="md" mb={2}>
            Laguppställningar
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <Box>
              <Text fontWeight={600} mb={2}>
                {teams.homeTeam?.name || "Hemma"}
              </Text>
              {asArray(teams.homePlayers).map((pl, idx) => (
                <Text key={`h-${pl.id || idx}`}>
                  {pl.jerseyNumber ? <Badge mr={2}>{pl.jerseyNumber}</Badge> : null}
                  {pl.name || [pl.firstName, pl.lastName].filter(Boolean).join(" ") || "Spelare"}
                </Text>
              ))}
            </Box>
            <Box>
              <Text fontWeight={600} mb={2}>
                {teams.awayTeam?.name || "Bortalag"}
              </Text>
              {asArray(teams.awayPlayers).map((pl, idx) => (
                <Text key={`a-${pl.id || idx}`}>
                  {pl.jerseyNumber ? <Badge mr={2}>{pl.jerseyNumber}</Badge> : null}
                  {pl.name || [pl.firstName, pl.lastName].filter(Boolean).join(" ") || "Spelare"}
                </Text>
              ))}
            </Box>
          </SimpleGrid>
        </>
      ) : null}
    </Box>
  );
}