// Chakra imports
import { Box, SimpleGrid, Text, Spinner, Button, Flex } from "@chakra-ui/react";
import DevelopmentTable from "views/admin/statistik/components/DevelopmentTable";
import React, { useEffect, useState } from "react";
import axios from 'axios';
import { API_BASE } from '../../../config/apiBase';
import { useMsal } from "@azure/msal-react";

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

const __CACHE_NS = 'HUB_SPORT_CACHE';

const makeKey = (...args) => {
  return [__CACHE_NS, ...args].join(':');
};

const getCache = (key) => {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed.expiry && parsed.expiry < Date.now()) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

const setCache = (key, data, ttlMs) => {
  const expiry = Date.now() + ttlMs;
  const cacheObj = { data, expiry };
  sessionStorage.setItem(key, JSON.stringify(cacheObj));
};

export default function StatistikDistrikt() {
  const { accounts } = useMsal();
  const coachId = accounts?.[0]?.localAccountId || '';
  const tenantId = accounts?.[0]?.tenantId || '';
  const cacheKey = makeKey('stats/district', coachId, tenantId);

  const [femaleData, setFemaleData] = useState([]);
  const [maleData, setMaleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${API_BASE}/stats/district`);
      setFemaleData(data.femaleData || []);
      setMaleData(data.maleData || []);
      setCache(cacheKey, data, 10 * 60 * 1000); // 10 minutes TTL
    } catch (err) {
      console.error('Error fetching district stats:', err);
      setError('Error fetching district stats: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = getCache(cacheKey);
    if (cached) {
      setFemaleData(cached.femaleData || []);
      setMaleData(cached.maleData || []);
      setLoading(false);
    } else {
      fetchData();
    }
  }, [cacheKey]);

  const handleRefresh = () => {
    sessionStorage.removeItem(cacheKey);
    fetchData();
  };

  if (loading) return <Spinner size="xl" speed="0.65s" thickness="4px" color="blue.500" position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" />;
  if (error) return <Text color="red">{error}</Text>;

  return (
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }}>
      <Flex justify="flex-end" mb="20px">
        <Button size="sm" variant="outline" onClick={handleRefresh}>
          Uppdatera
        </Button>
      </Flex>
      <SimpleGrid columns={{ sm: 1, md: 2 }} spacing={{ base: "20px", xl: "20px" }}>
        <DevelopmentTable columnsData={columnsDataPlayers} tableData={femaleData} title="Bästa Rankade Tjejer" />
        <DevelopmentTable columnsData={columnsDataPlayers} tableData={maleData} title="Bästa Rankade Killar" />
      </SimpleGrid>
    </Box>
  );
}