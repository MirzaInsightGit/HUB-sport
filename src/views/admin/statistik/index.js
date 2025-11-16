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

const round3 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
};

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
    { Header: "TRÖJNUMMER", accessor: "jerseyNumber" },
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
    { Header: "TRÖJNUMMER", accessor: "jerseyNumber" },
    { Header: "FORM", accessor: "form" },
    { Header: "SNITT POÄNG", accessor: "average" },
    { Header: "LÄGER 1", accessor: "camp1" },
    { Header: "LÄGER 2", accessor: "camp2" },
  ],
  3: [
    { Header: "NAMN", accessor: "name" },
    { Header: "TRÖJNUMMER", accessor: "jerseyNumber" },
    { Header: "JÄMFÖRELSE", accessor: "comparison" },
    { Header: "SNITT POÄNG", accessor: "average" },
  ],
  4: [
    { Header: "NAMN", accessor: "name" },
    { Header: "TRÖJNUMMER", accessor: "jerseyNumber" },
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
      const players = Array.isArray(payload?._players) ? payload._players : [];

      // Bygg ett index av stats från payload baserat på e-post/id
      const statsList = [];
      if (Array.isArray(payload?.players)) statsList.push(...payload.players);
      if (Array.isArray(payload?.femaleData)) statsList.push(...payload.femaleData);
      if (Array.isArray(payload?.maleData)) statsList.push(...payload.maleData);
      if (Array.isArray(payload?.data)) statsList.push(...payload.data);

      const statsIndex = new Map();
      statsList.forEach((s) => {
        const keys = [
          s.spelarmejl,
          s.playerEmail,
          s.email,
          s.id,
          s.playerId,
        ].filter(Boolean);

        keys.forEach((k) => {
          const key = String(k).toLowerCase();
          if (!key) return;
          if (!statsIndex.has(key)) {
            statsIndex.set(key, s);
          }
        });
      });

      const females = [];
      const males = [];

      players.forEach((p) => {
        const candidateKeys = [
          p.spelarmejl,
          p.playerEmail,
          p.email,
          p.id,
          p.playerId,
        ]
          .filter(Boolean)
          .map((k) => String(k).toLowerCase());

        let stat = null;
        for (let i = 0; i < candidateKeys.length; i++) {
          const key = candidateKeys[i];
          if (statsIndex.has(key)) {
            stat = statsIndex.get(key);
            break;
          }
        }

        const genderRaw = String(p.gender || p.kon || "").toLowerCase().trim();

        const isFemale =
          genderRaw.includes("kvinna") ||
          genderRaw.includes("flick") ||
          genderRaw === "f" ||
          genderRaw === "female";

        const isMale =
          genderRaw.includes("kille") ||
          genderRaw.includes("pojke") ||
          genderRaw.includes("man") ||
          genderRaw === "m" ||
          genderRaw === "male";

        const row = {
          name:
            p.spelarnamn ||
            p.playerName ||
            p.fullName ||
            p.fullname ||
            displayName(p),
          jerseyNumber:
            // 1) Cosmos / players (samma som i Anmälan + Distrikt-listan)
            p.jerseyNumber ??
            p.tronummer ??
            p.trojnummer ??
            p.trojNummer ??
            // 2) fallback: om backend skickar tröjnummer via stats-payloaden
            stat?.jerseyNumber ??
            stat?.tronummer ??
            stat?.trojnummer ??
            stat?.trojNummer ??
            null,
          // rank sätts efter sortering baserat på snittpoäng
          rank: null,
          ratedBy: stat ? latestCoach(stat) : "-",
          average: round3(stat?.average ?? stat?.avg ?? stat?.snitt ?? 0),
          camp1: round3(stat?.camp1 ?? stat?.lager1 ?? 0),
          camp2: round3(stat?.camp2 ?? stat?.lager2 ?? 0),
          camp3: round3(stat?.camp3 ?? stat?.lager3 ?? 0),
          camp4: round3(stat?.camp4 ?? stat?.lager4 ?? 0),
          camp5: round3(stat?.camp5 ?? stat?.lager5 ?? 0),
          form: stat && stat.form != null ? round3(stat.form) : undefined,
          comparison:
            stat && stat.comparison != null
              ? round3(stat.comparison)
              : undefined,
          quality:
            stat && stat.quality != null ? round3(stat.quality) : undefined,
        };

        if (isFemale) {
          females.push(row);
        } else if (isMale) {
          males.push(row);
        } else {
          // okänt kön — lägg till i tjejlistan så att ingen tappas bort
          females.push(row);
        }
      });

      const sortByAverageDesc = (a, b) => {
        const av = Number.isFinite(a.average) ? a.average : 0;
        const bv = Number.isFinite(b.average) ? b.average : 0;
        return bv - av;
      };

      females.sort(sortByAverageDesc);
      males.sort(sortByAverageDesc);

      females.forEach((r, idx) => {
        r.rank = idx + 1;
      });
      males.forEach((r, idx) => {
        r.rank = idx + 1;
      });

      return { femaleData: females, maleData: males };
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
      // Fetch full players list so normalize can enrich stats with kön/namn/tröjnummer
      try {
        const playersRes = await axios.get(`${API_BASE}/district/players`, {
          headers: { "x-dev-coachid": coachHeader, "x-tenant-id": tenantHeader },
        });

        const playersJson = playersRes.data;
        const playersArr = Array.isArray(playersJson?.players)
          ? playersJson.players
          : Array.isArray(playersJson)
          ? playersJson
          : [];

        responseData._players = playersArr;
      } catch (e) {
        // ignore – normalize faller tillbaka på stats-payloaden
      }

      const { femaleData, maleData } = normalize(responseData || {});

      const isFullyRatedRow = (r = {}) => {
        if (typeof r.fullyRated === "boolean") return r.fullyRated;
        if (typeof r.isFullyRated === "boolean") return r.isFullyRated;
        if (typeof r.allRated === "boolean") return r.allRated;
        // fallback: om quality finns och är > 0, betrakta den som betygsatt
        if (typeof r.quality === "number") return r.quality > 0;
        return true;
      };

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
          };
        });

      const femaleAll = decorate(femaleData);
      const maleAll = decorate(maleData);

      const female = onlyFullyRated ? femaleAll.filter(isFullyRatedRow) : femaleAll;
      const male = onlyFullyRated ? maleAll.filter(isFullyRatedRow) : maleAll;

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