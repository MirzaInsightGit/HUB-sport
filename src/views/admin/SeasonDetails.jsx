// src/components/SeasonDetails.jsx - Update to handle tree structure
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Box, Heading, Tabs, TabList, TabPanels, Tab, TabPanel, Table, Thead, Tbody, Tr, Th, Td, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon } from '@chakra-ui/react';
import { useProfixio, useProfixioSeasonTournaments } from '../../hooks/useProfixio';
import useAuth from '../../hooks/useAuth';

const SeasonDetails = () => {
  const { id } = useParams();
  const { getSeasonMatches, getSeasonDeletedMatches } = useProfixio();
  const { data: tree, loading: tournamentsLoading } = useProfixioSeasonTournaments(id);
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [deletedMatches, setDeletedMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const matchesData = await getSeasonMatches(id, user.idToken);
        const deletedData = await getSeasonDeletedMatches(id, user.idToken);
        setMatches(matchesData.data || []);
        setDeletedMatches(deletedData.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user.idToken) fetchData();
  }, [id, user.idToken, getSeasonMatches, getSeasonDeletedMatches]);

  if (loading || tournamentsLoading) return <p>Laddar...</p>;

  return (
    <Box p={5}>
      <Heading mb={4}>Säsong Detaljer: {id}</Heading>
      <Tabs>
        <TabList>
          <Tab>Tävlingar</Tab>
          <Tab>Matcher</Tab>
          <Tab>Raderade Matcher</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Accordion allowToggle>
              {tree.map((category) => (
                <AccordionItem key={category.id}>
                  <h2>
                    <AccordionButton>
                      <Box flex="1" textAlign="left">
                        {category.name} ({category.divisions.reduce((acc, div) => acc + div.tournaments.length, 0)} tävlingar)
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                  </h2>
                  <AccordionPanel pb={4}>
                    {category.divisions.map((division) => (
                      <AccordionItem key={division.id}>
                        <h3>
                          <AccordionButton>
                            <Box flex="1" textAlign="left">
                              {division.name}
                            </Box>
                            <AccordionIcon />
                          </AccordionButton>
                        </h3>
                        <AccordionPanel pb={4}>
                          <Table variant="simple">
                            <Thead>
                              <Tr>
                                <Th>Namn</Th>
                                <Th>Matcher</Th>
                                <Th>Detaljer</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {division.tournaments.map((t) => (
                                <Tr key={t.id}>
                                  <Td>{t.name}</Td>
                                  <Td>{t.matchCount}</Td>
                                  <Td><Link to={`/admin/tournaments/${t.id}`}>Visa</Link></Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </AccordionPanel>
                      </AccordionItem>
                    ))}
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </TabPanel>
          <TabPanel>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Hemmalag</Th>
                  <Th>Bortalag</Th>
                  <Th>Datum</Th>
                  <Th>Detaljer</Th>
                </Tr>
              </Thead>
              <Tbody>
                {matches.map((m) => (
                  <Tr key={m.id}>
                    <Td>{m.id}</Td>
                    <Td>{m.home_team?.name || 'N/A'}</Td>
                    <Td>{m.away_team?.name || 'N/A'}</Td>
                    <Td>{m.match_date || 'N/A'}</Td>
                    <Td><Link to={`/admin/matches/${m.id}`}>Visa</Link></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TabPanel>
          <TabPanel>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Hemmalag</Th>
                  <Th>Bortalag</Th>
                  <Th>Datum</Th>
                  <Th>Detaljer</Th>
                </Tr>
              </Thead>
              <Tbody>
                {deletedMatches.map((dm) => (
                  <Tr key={dm.id}>
                    <Td>{dm.id}</Td>
                    <Td>{dm.home_team?.name || 'N/A'}</Td>
                    <Td>{dm.away_team?.name || 'N/A'}</Td>
                    <Td>{dm.match_date || 'N/A'}</Td>
                    <Td><Link to={`/admin/matches/${dm.id}`}>Visa</Link></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default SeasonDetails;