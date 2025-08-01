import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProfixioTournamentMatches, useProfixioTournamentTeams } from '../../hooks/useProfixio';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td } from '@chakra-ui/react';

const TournamentDetails = () => {
  const { tournamentId } = useParams();
  const { data: matches, loading: mLoading } = useProfixioTournamentMatches(tournamentId);
  const { data: teams, loading: tLoading } = useProfixioTournamentTeams(tournamentId, { players: 1 });

  if (mLoading || tLoading) return <p>Laddar...</p>;
  return (
    <Box p={5}>
      <Heading mb={4}>Matcher</Heading>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Match ID</Th>
            <Th>Hemmalag</Th>
            <Th>Bortalag</Th>
            <Th>Resultat</Th>
          </Tr>
        </Thead>
        <Tbody>
          {matches.map(m => (
            <Tr key={m.id}>
              <Td>{m.id}</Td>
              <Td>{m.homeTeam}</Td>
              <Td>{m.awayTeam}</Td>
              <Td>{m.result}</Td>
            </Tr>
          ))}
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
          {teams.map(team => (
            <Tr key={team.id}>
              <Td>{team.name}</Td>
              <Td>
                <ul>
                  {team.players.map(player => <li key={player.id}>{player.name}</li>)}
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