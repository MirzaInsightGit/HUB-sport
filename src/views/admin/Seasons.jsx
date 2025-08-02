// src/components/Seasons.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useProfixioSeasons } from '../../hooks/useProfixio';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td } from '@chakra-ui/react';

const Seasons = () => {
  const orgId = process.env.REACT_APP_PROFIXIO_ORG;
  const { data: seasons, loading } = useProfixioSeasons(orgId);

  if (loading) return <p>Laddar...</p>;
  return (
    <Box p={5}>
      <Heading mb={4}>Säsonger</Heading>
      <Table variant="striped" colorScheme="blue">
        <Thead>
          <Tr>
            <Th>Namn</Th>
            <Th>Startdatum</Th>
            <Th>Slutdatum</Th>
            <Th>Status</Th>
            <Th>Detaljer</Th>
          </Tr>
        </Thead>
        <Tbody>
          {seasons.map((s, index) => (
            <Tr key={index}>
              <Td>{s.name || 'N/A'}</Td>
              <Td>{s.seasonStartDate || 'N/A'}</Td>
              <Td>{s.seasonEndDate || 'N/A'}</Td>
              <Td>{s.currentlyActive ? 'Aktiv' : 'Inaktiv'}</Td>
              <Td><Link to={`/admin/seasons/${s.id}`}>Visa</Link></Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default Seasons;