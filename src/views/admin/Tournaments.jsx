import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box, Heading, Text, Badge, Tabs, TabList, TabPanels, Tab, TabPanel,
  Table, Thead, Tbody, Tr, Th, Td, Spinner, Button, HStack
} from '@chakra-ui/react';
import { useProfixioTournamentMatches, useProfixioTournamentTeams } from '../../hooks/useProfixio';

const normalizeMatches = (raw) => {
  const list = Array.isArray(raw) ? raw : (raw?.data || []);
  return list.map((m) => ({
    id: m?.id ?? m?.matchId ?? m?.code,
    home: m?.homeTeamName ?? m?.homeTeam ?? m?.home ?? '-',
    away: m?.awayTeamName ?? m?.awayTeam ?? m?.away ?? '-',
    result: m?.result ?? (m?.homeScore != null && m?.awayScore != null ? `${m.homeScore}-${m.awayScore}` : '-'),
    date: m?.start ?? m?.date ?? m?.startDate ?? null,
    status: m?.status || undefined,
  }));
};

const normalizeTeams = (raw) => {
  const list = Array.isArray(raw) ? raw : (raw?.data || []);
  return list.map((t) => ({
    id: t?.id ?? t?.teamId ?? t?.code,
    name: t?.name ?? t?.teamName ?? '-',
    seed: t?.seed ?? t?.seeding ?? null,
    players: Array.isArray(t?.players) ? t.players : [],
  }));
};

export default function TournamentDetails() {
  const { tournamentId } = useParams();
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data: rawMatches, loading: mLoading } = useProfixioTournamentMatches(tournamentId, { page, limit });
  const { data: rawTeams, loading: tLoading } = useProfixioTournamentTeams(tournamentId, { players: 1 });

  const matches = useMemo(() => normalizeMatches(rawMatches), [rawMatches]);
  const teams = useMemo(() => normalizeTeams(rawTeams), [rawTeams]);

  const meta = rawMatches?.meta || { current_page: page, last_page: page, total: matches.length };
  const loading = mLoading || tLoading;

  const canPrev = (meta?.current_page || 1) > 1;
  const canNext = (meta?.current_page || 1) < (meta?.last_page || 1);

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
          <Tab>Matcher</Tab>
          <Tab>Lag & spelare</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            {matches.length === 0 ? (
              <Text>Inga matcher hittades.</Text>
            ) : (
              <>
                <HStack justify="space-between" mb={3}>
                  <Text>Totalt: {meta?.total ?? matches.length} • Sida {meta?.current_page ?? page} av {meta?.last_page ?? 1}</Text>
                  <HStack>
                    <Button size="sm" onClick={() => setPage(1)} isDisabled={!canPrev}>« Första</Button>
                    <Button size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} isDisabled={!canPrev}>‹ Föregående</Button>
                    <Button size="sm" onClick={() => setPage(p => p + 1)} isDisabled={!canNext}>Nästa ›</Button>
                    <Button size="sm" onClick={() => setPage(meta?.last_page || page)} isDisabled={!canNext}>Sista »</Button>
                  </HStack>
                </HStack>
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>Match ID</Th>
                      <Th>Hemmalag</Th>
                      <Th>Bortalag</Th>
                      <Th>Resultat</Th>
                      <Th>Datum</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {matches.map((m) => (
                      <Tr key={m.id}>
                        <Td>{m.id}</Td>
                        <Td>{m.home}</Td>
                        <Td>{m.away}</Td>
                        <Td>{m.result}</Td>
                        <Td>{m.date ? new Date(m.date).toLocaleString() : '-'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </>
            )}
          </TabPanel>

          <TabPanel>
            {teams.length === 0 ? (
              <Text>Inga lag hittades.</Text>
            ) : (
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Lag</Th>
                    <Th>Seed</Th>
                    <Th>Spelare</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {teams.map((t) => (
                    <Tr key={t.id}>
                      <Td>{t.name}</Td>
                      <Td>{t.seed ?? '-'}</Td>
                      <Td>
                        {t.players.length === 0 ? (
                          <Text opacity={0.7}>Inga spelare listade</Text>
                        ) : (
                          <ul style={{ paddingLeft: 16, margin: 0 }}>
                            {t.players.map((p) => (
                              <li key={p?.id || p?.playerId || p?.name}>{p?.name || p?.fullName || 'Okänd spelare'}</li>
                            ))}
                          </ul>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Box mt={6}>
        <Link to="/admin/seasons">← Tillbaka till säsonger</Link>
      </Box>
    </Box>
  );
}