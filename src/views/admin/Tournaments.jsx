import React from 'react';
import { Link } from 'react-router-dom';
import { useProfixioTournaments, useProfixioUserInfo } from '../../hooks/useProfixio';
import { Box, Heading, Text, Table, Thead, Tbody, Tr, Th, Td } from '@chakra-ui/react';

const Tournaments = () => {
  const orgId = process.env.REACT_APP_PROFIXIO_ORG;
  const params = { sportId: 'BB', limit: 15, page: 1 };
  const { data: tournaments, loading: tLoading } = useProfixioTournaments(orgId, params);
  const { data: userInfo, loading: uLoading } = useProfixioUserInfo();

  if (tLoading || uLoading) return <p>Laddar...</p>;
  return (
    <Box p={5}>
      <Heading mb={4}>Användarinfo</Heading>
      <Text>Applikationsnamn: {userInfo.applicationName || 'N/A'}</Text>
      <Text>E-post: {userInfo.contactEmail || 'N/A'}</Text>
      <Text>Namn: {userInfo.contactName || 'N/A'}</Text>
      <Text>Organisation: {userInfo.organisations?.[0]?.organisationId || 'N/A'}</Text>
      <Text>Visa turneringar: {userInfo.permissions?.viewTournaments ? 'Ja' : 'Nej'}</Text>
      <Text>Lista turneringar: {userInfo.permissions?.listTournaments ? 'Ja' : 'Nej'}</Text>
      <Text>Uppdatera alla turneringar: {userInfo.permissions?.updateAllTournaments ? 'Ja' : 'Nej'}</Text>
      <Text>Uppdatera specifika turneringar: {userInfo.permissions?.updateSpecificTournaments ? 'Ja' : 'Nej'}</Text>
      <Text>SpecificTournaments: {userInfo.permissions?.specificTournaments?.join(', ') || 'N/A'}</Text>

      <Heading mt={8} mb={4}>Turneringar</Heading>
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
          {tournaments.map((t, index) => (
            <Tr key={index}>
              <Td>{t.name || 'N/A'}</Td>
              <Td>{t.startDate || 'N/A'}</Td>
              <Td>{t.endDate || 'N/A'}</Td>
              <Td>{t.status || 'N/A'}</Td>
              <Td><Link to={`/admin/tournaments/${t.id}`}>Visa</Link></Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default Tournaments;