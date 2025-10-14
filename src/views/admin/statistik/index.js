// Chakra imports
import { Box, SimpleGrid, Text, Spinner, Button, Flex, Switch, Tooltip, HStack, useColorModeValue } from "@chakra-ui/react";
import DevelopmentTable from "views/admin/statistik/components/DevelopmentTable";
import React, { useEffect, useState } from "react";
import axios from 'axios';
import { API_BASE } from '../../../config/apiBase';
import { useMsal } from "@azure/msal-react";

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

const columnsByPanel = {
  1: [
    { Header: "NAMN", accessor: "name" },
    { Header: "RANK", accessor: "rank" },
    { Header: "COACHER", accessor: "ratedBy" },
    { Header: "SNITT POÄNG", accessor: "average" },
    { Header: "LÄGER 1", accessor: "camp1" },
    { Header: "LÄGER 2", accessor: "camp2" },
    { Header: "LÄGER 3", accessor: "camp3" },
    { Header: "LÄGER 4", accessor: "camp4" },
    { Header: "LÄGER 5", accessor: "camp5" },
  ],
  2: [
    { Header: "NAMN", accessor: "name" },
    { Header: "FORM", accessor: "form" },
    { Header: "COACHER", accessor: "ratedBy" },
    { Header: "SNITT POÄNG", accessor: "average" },
    { Header: "LÄGER 1", accessor: "camp1" },
    { Header: "LÄGER 2", accessor: "camp2" },
  ],
  3: [
    { Header: "NAMN", accessor: "name" },
    { Header: "JÄMFÖRELSE", accessor: "comparison" },
    { Header: "COACHER", accessor: "ratedBy" },
    { Header: "SNITT POÄNG", accessor: "average" },
  ],
  4: [
    { Header: "NAMN", accessor: "name" },
    { Header: "KVALITET", accessor: "quality" },
    { Header: "COACHER", accessor: "ratedBy" },
    { Header: "SNITT POÄNG", accessor: "average" },
  ],
};

export default function StatistikDistrikt() {
  const { accounts } = useMsal();
  const coachId = accounts?.[0]?.localAccountId || '';
  const tenantId = accounts?.[0]?.tenantId || '';

  const [onlyFullyRated, setOnlyFullyRated] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [panel, setPanel] = useState(1);

  const cacheKey = makeKey('stats/district', coachId, tenantId, String(onlyFullyRated), String(onlyFavorites), String(panel));

  const [femaleData, setFemaleData] = useState([]);
  const [maleData, setMaleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${API_BASE}/stats/district`, {
        headers: {
          "x-dev-coachid": accounts?.[0]?.username || coachId,
          "x-tenant-id": tenantId || "single",
        },
        params: {
          onlyFullyRated: onlyFullyRated ? 1 : 0,
          favoritesOnly: onlyFavorites ? 1 : 0,
          panel: panel,
        },
      });
      const decorate = (rows=[]) => rows.map(r => ({
        ...r,
        ratedBy: (r.coachCountRated != null && r.totalCoaches != null)
          ? `${r.coachCountRated}/${r.totalCoaches}`
          : (r.ratedBy || "-"),
      }));
      const female = decorate(data.femaleData || []);
      const male = decorate(data.maleData || []);
      setFemaleData(female);
      setMaleData(male);
      setCache(cacheKey, { femaleData: female, maleData: male }, 10 * 60 * 1000);
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
  }, [cacheKey, onlyFullyRated, onlyFavorites, panel]);

  const handleRefresh = () => {
    sessionStorage.removeItem(cacheKey);
    fetchData();
  };

  const columnsDataPlayers = columnsByPanel[panel];

  const bgBar = useColorModeValue("gray.50", "gray.700");
  const bgGrid = useColorModeValue("white", "gray.800");

  if (loading) return <Spinner size="xl" speed="0.65s" thickness="4px" color="blue.500" position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" />;
  if (error) return <Text color="red">{error}</Text>;

  return (
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }} px={{ base: 4, md: 8, xl: 12 }}>
      <Flex
        justify="space-between"
        align="center"
        mb="6"
        p={4}
        bg={bgBar}
        borderRadius="md"
      >
        <HStack spacing={6}>
          <Tooltip label="Visa bara spelare som är betygsatta av alla coacher i tenantet" hasArrow>
            <HStack>
              <Switch
                isChecked={onlyFullyRated}
                onChange={(e) => {
                  setOnlyFullyRated(e.target.checked);
                  sessionStorage.removeItem(cacheKey);
                }}
                colorScheme="purple"
              />
              <Text fontSize="sm" whiteSpace="nowrap">Visa fullständigt betygsatta</Text>
            </HStack>
          </Tooltip>
          <Tooltip label="Visa bara mina favoritspelare" hasArrow>
            <HStack>
              <Switch
                isChecked={onlyFavorites}
                onChange={(e) => {
                  setOnlyFavorites(e.target.checked);
                  sessionStorage.removeItem(cacheKey);
                }}
                colorScheme="purple"
              />
              <Text fontSize="sm" whiteSpace="nowrap">Visa bara favoriter</Text>
            </HStack>
          </Tooltip>
        </HStack>
        <Button size="sm" variant="outline" onClick={handleRefresh}>
          Uppdatera
        </Button>
      </Flex>
      <Flex mb="6" justify="center" gap="3">
        <Button
          size="sm"
          variant={panel === 1 ? "solid" : "outline"}
          colorScheme={panel === 1 ? "purple" : undefined}
          borderRadius="full"
          onClick={() => { setPanel(1); sessionStorage.removeItem(cacheKey); fetchData(); }}
        >
          Total
        </Button>
        <Button
          size="sm"
          variant={panel === 2 ? "solid" : "outline"}
          colorScheme={panel === 2 ? "purple" : undefined}
          borderRadius="full"
          onClick={() => { setPanel(2); sessionStorage.removeItem(cacheKey); fetchData(); }}
        >
          Form
        </Button>
        <Button
          size="sm"
          variant={panel === 3 ? "solid" : "outline"}
          colorScheme={panel === 3 ? "purple" : undefined}
          borderRadius="full"
          onClick={() => { setPanel(3); sessionStorage.removeItem(cacheKey); fetchData(); }}
        >
          Jämförelse
        </Button>
        <Button
          size="sm"
          variant={panel === 4 ? "solid" : "outline"}
          colorScheme={panel === 4 ? "purple" : undefined}
          borderRadius="full"
          onClick={() => { setPanel(4); sessionStorage.removeItem(cacheKey); fetchData(); }}
        >
          Kvalitet
        </Button>
      </Flex>
      <SimpleGrid
        columns={{ sm: 1, md: 2 }}
        spacing={{ base: "20px", xl: "20px" }}
        p={4}
        bg={bgGrid}
        borderRadius="xl"
        boxShadow="md"
      >
        <DevelopmentTable columnsData={columnsDataPlayers} tableData={femaleData} title="Bästa Rankade Tjejer" />
        <DevelopmentTable columnsData={columnsDataPlayers} tableData={maleData} title="Bästa Rankade Killar" />
      </SimpleGrid>
    </Box>
  );
}