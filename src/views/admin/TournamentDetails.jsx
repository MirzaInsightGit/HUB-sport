import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td } from '@chakra-ui/react';
import { useProfixioTournamentMatches, useProfixioTournamentTeams } from '../../hooks/useProfixio';

const TournamentDetails = () => {
  const { tournamentId } = useParams();
  const { data: matches, loading: mLoading } = useProfixioTournamentMatches(tournamentId);
  const { data: teams, loading: tLoading } = useProfixioTournamentTeams(tournamentId, { players: 1 });

  if (mLoading || tLoading) return <Box p={5}>Laddar…</Box>;

  const matchRows = Array.isArray(matches?.data) ? matches.data : (Array.isArray(matches) ? matches : []);
  const teamRows = Array.isArray(teams?.data) ? teams.data : (Array.isArray(teams) ? teams : []);

  return (
    <Box p={5}>
      <Heading mb={4}>Matcher</Heading>
      <Table variant="simple" mb={10}>
        <Thead>
          <Tr>
            <Th>Match ID</Th>
            <Th>Hemmalag</Th>
            <Th>Bortalag</Th>
            <Th>Resultat</Th>
          </Tr>
        </Thead>
        <Tbody>
          {matchRows.map((m) => {
            const home = m?.homeTeam?.name || m?.homeTeam || m?.home?.name || '-';
            const away = m?.awayTeam?.name || m?.awayTeam || m?.away?.name || '-';
            const res  = m?.result ?? '—';
            const mid  = m?.number || m?.id;
            return (
              <Tr key={mid}>
                <Td>
                  <Link to={`/admin/matches/${tournamentId}/${m.id || m.matchId || mid}`}>
                    {mid}
                  </Link>
                </Td>
                <Td>{home}</Td>
                <Td>{away}</Td>
                <Td>{res}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>

      <Heading mt={8} mb={4}>Lag och Spelare</Heading>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Lagnamn</Th>
            <Th>Spelare</Th>
          </Tr>
        </Thead>
        <Tbody>
          {teamRows.map((team) => (
            <Tr key={team.id || team.teamRegistrationId}>
              <Td>{team.name}</Td>
              <Td>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {(team.players || []).map((p) => (
                    <li key={p.id || p.playerId}>{p.name}</li>
                  ))}
                </ul>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default TournamentDetails;