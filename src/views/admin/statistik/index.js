// Chakra imports
import { Box, SimpleGrid, Text, Spinner, Button, Flex, Switch, Tooltip, HStack, useColorModeValue } from "@chakra-ui/react";
import DevelopmentTable from "views/admin/statistik/components/DevelopmentTable";
import React, { useEffect, useState } from "react";
import axios from 'axios';
import { API_BASE } from '../../../config/apiBase';
import { useMsal } from "@azure/msal-react";


const __CACHE_NS = 'HUB_SPORT_CACHE';

/** Helpers to display nicer names and coach info */
const toTitle = (s = "") =>
  s
    .replace(/[_.-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const prettyNameFromEmail = (email = "") => {
  const left = String(email).split("@")[0] || "";
  return toTitle(left);
};

const pick = (...vals) => vals.find((v) => v != null && v !== "") ?? null;

const displayName = (p = {}) =>
  pick(p.displayName, p.name, p.playerName, p.fullName, p.fullname) ||
  prettyNameFromEmail(p.id || p.playerId || p.email || "");

const latestCoach = (p = {}) =>
  pick(
    p.lastCoach,
    p.lastRatedBy,
    p.latestBy,
    p.latestCoach,
    p.by,
    Array.isArray(p.coaches) && p.coaches[p.coaches.length - 1]
  ) || "-";

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
    { Header: "SNITT POÄNG", accessor: "average" },
    { Header: "LÄGER 1", accessor: "camp1" },
    { Header: "LÄGER 2", accessor: "camp2" },
  ],
  3: [
    { Header: "NAMN", accessor: "name" },
    { Header: "JÄMFÖRELSE", accessor: "comparison" },
    { Header: "SNITT POÄNG", accessor: "average" },
  ],
  4: [
    { Header: "NAMN", accessor: "name" },
    { Header: "KVALITET", accessor: "quality" },
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

    const coachHeader = accounts?.[0]?.username || coachId;
    const tenantHeader = tenantId || "single";

    // helper to normalize various server payloads into the
    // { femaleData:[], maleData:[] } shape we render
    const normalize = (payload) => {
      // already in final shape
      if (payload?.femaleData || payload?.maleData) {
        return {
          femaleData: payload.femaleData || [],
          maleData: payload.maleData || [],
        };
      }

      // legacy aggregated list without gender split
      if (Array.isArray(payload?.players)) {
        const byGender = (list = []) => {
          const f = [], m = [];
          list.forEach((p, idx) => {
            const row = {
              name: displayName(p),
              rank: p.rank ?? p.position ?? "-",
              ratedBy: latestCoach(p),
              average: p.average ?? p.avg ?? p.snitt ?? 0,
              camp1: p.camp1 ?? p.lager1 ?? 0,
              camp2: p.camp2 ?? p.lager2 ?? 0,
              camp3: p.camp3 ?? p.lager3 ?? 0,
              camp4: p.camp4 ?? p.lager4 ?? 0,
              camp5: p.camp5 ?? p.lager5 ?? 0,
              form: p.form,
              comparison: p.comparison,
              quality: p.quality,
            };

            const g = String(p.gender || p.kon || "").toLowerCase();
            const isFemale =
              g.startsWith("k") ||
              g.includes("kvinna") ||
              g.includes("flicka") ||
              g === "f" ||
              g === "female";
            const isMale =
              g.startsWith("m") ||
              g.includes("man") ||
              g.includes("pojke") ||
              g === "m" ||
              g === "male";

            if (isFemale) f.push(row);
            else if (isMale) m.push(row);
            else (idx % 2 === 0 ? f : m).push(row); // deterministic fallback to avoid empty column
          });
          return { femaleData: f, maleData: m };
        };
        return byGender(payload.players);
      }

      // unknown shape -> fail fast
      throw new Error("Unsupported stats payload");
    };

    // Try canonical endpoint first, then fall back to the older one
    const endpoints = [
      `${API_BASE}/stats/district`,
      `${API_BASE}/stats/players`,
    ];

    try {
      let responseData = null;
      for (let i = 0; i < endpoints.length; i++) {
        try {
          const { data } = await axios.get(endpoints[i], {
            headers: { "x-dev-coachid": coachHeader, "x-tenant-id": tenantHeader },
            params: {
              onlyFullyRated: onlyFullyRated ? 1 : 0,
              favoritesOnly: onlyFavorites ? 1 : 0,
              panel,
            },
          });
          responseData = data;
          break; // success
        } catch (e) {
          if (i === endpoints.length - 1) throw e; // rethrow on last
        }
      }

      const { femaleData, maleData } = normalize(responseData || {});

      const decorate = (rows = []) =>
        rows.map((r) => {
          const resolvedName = (
            r.name ||
            displayName(r) ||
            displayName({ id: r.id, playerId: r.playerId, email: r.email }) ||
            prettyNameFromEmail(r.id || r.playerId || r.email || "")
          );
          return {
            ...r,
            name: resolvedName,
            camp1: r.camp1 ?? 0,
            camp2: r.camp2 ?? 0,
            camp3: r.camp3 ?? 0,
            camp4: r.camp4 ?? 0,
            camp5: r.camp5 ?? 0,
          };
        });

      const female = decorate(femaleData);
      const male = decorate(maleData);

      setFemaleData(female);
      setMaleData(male);
      setCache(cacheKey, { femaleData: female, maleData: male }, 10 * 60 * 1000);
    } catch (err) {
      console.error("Error fetching district stats:", err);
      const msg = err.response?.data?.error || err.message || "unknown";
      setError("Error fetching district stats: " + msg);
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
        <Tooltip label="Samlad ranking: medelvärde över alla coachers betyg." hasArrow>
          <Button
            size="sm"
            variant={panel === 1 ? "solid" : "outline"}
            colorScheme={panel === 1 ? "purple" : undefined}
            borderRadius="full"
            onClick={() => { setPanel(1); sessionStorage.removeItem(cacheKey); fetchData(); }}
          >
            Total
          </Button>
        </Tooltip>
        <Tooltip label="Senaste utveckling: vikt på de färskaste betygen." hasArrow>
          <Button
            size="sm"
            variant={panel === 2 ? "solid" : "outline"}
            colorScheme={panel === 2 ? "purple" : undefined}
            borderRadius="full"
            onClick={() => { setPanel(2); sessionStorage.removeItem(cacheKey); fetchData(); }}
          >
            Form
          </Button>
        </Tooltip>
        <Tooltip label="Jämför spelare relativt gruppen/position." hasArrow>
          <Button
            size="sm"
            variant={panel === 3 ? "solid" : "outline"}
            colorScheme={panel === 3 ? "purple" : undefined}
            borderRadius="full"
            onClick={() => { setPanel(3); sessionStorage.removeItem(cacheKey); fetchData(); }}
          >
            Jämförelse
          </Button>
        </Tooltip>
        <Tooltip label="Kvalitetsmått: stabilitet och antal betyg." hasArrow>
          <Button
            size="sm"
            variant={panel === 4 ? "solid" : "outline"}
            colorScheme={panel === 4 ? "purple" : undefined}
            borderRadius="full"
            onClick={() => { setPanel(4); sessionStorage.removeItem(cacheKey); fetchData(); }}
          >
            Kvalitet
          </Button>
        </Tooltip>
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