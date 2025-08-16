// Chakra imports
import { Box, SimpleGrid, Text, Spinner } from "@chakra-ui/react";
import DevelopmentTable from "views/admin/statistik/components/DevelopmentTable";
import React, { useEffect, useState } from "react";
import axios from 'axios';
import { API_BASE } from '../../../config/apiBase';

const columnsDataPlayers = [
  { Header: "NAMN", accessor: "name" },
  { Header: "RANK", accessor: "rank" },
  { Header: "SNITT POÄNG", accessor: "average" },
  { Header: "LÄGER 1", accessor: "camp1" },
  { Header: "LÄGER 2", accessor: "camp2" },
  { Header: "LÄGER 3", accessor: "camp3" },
  { Header: "LÄGER 4", accessor: "camp4" },
  { Header: "LÄGER 5", accessor: "camp5" },
];

export default function StatistikDistrikt() {
  const [femaleData, setFemaleData] = useState([]);
  const [maleData, setMaleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/stats/district`);
        setFemaleData(data.femaleData || []);
        setMaleData(data.maleData || []);
      } catch (err) {
        console.error('Error fetching district stats:', err);
        setError('Error fetching district stats: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <Spinner size="xl" speed="0.65s" thickness="4px" color="blue.500" position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" />;
  if (error) return <Text color="red">{error}</Text>;

  return (
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }}>
      <SimpleGrid columns={{ sm: 1, md: 2 }} spacing={{ base: "20px", xl: "20px" }}>
        <DevelopmentTable columnsData={columnsDataPlayers} tableData={femaleData} title="Bästa Rankade Tjejer" />
        <DevelopmentTable columnsData={columnsDataPlayers} tableData={maleData} title="Bästa Rankade Killar" />
      </SimpleGrid>
    </Box>
  );
}