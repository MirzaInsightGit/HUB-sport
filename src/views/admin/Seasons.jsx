// src/views/admin/Seasons.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Tabs,
  TabList,
  Tab,
  HStack,
  Input,
  Select,
  Tag,
  TagLabel,
  TagCloseButton,
  Spinner,
  Text,
  VStack,
  useColorModeValue,
  Button,
  Wrap,
  WrapItem,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionIcon,
  AccordionPanel,
  Badge,
  Divider,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  useProfixioSeasons,
  useProfixioSeasonTournaments,
} from "../../hooks/useProfixio";

const ORG_ID = process.env.REACT_APP_PROFIXIO_ORG || "SBBF.SE.BB";
const TOURNAMENT_ROUTE_BASE = "/admin/tournaments";

/** Länk (piller) till turnering */
const TournamentLink = ({ t }) => {
  const id = t?.id ?? t?.tournamentId ?? t?.code;
  const name = t?.name ?? `Turnering ${id}`;
  if (!id) return null;
  return (
    <WrapItem>
      <Button
        as={Link}
        to={`${TOURNAMENT_ROUTE_BASE}/${encodeURIComponent(id)}`}
        size="xs"
        variant="outline"
        borderRadius="full"
        px={3}
        py={1}
      >
        {name}
      </Button>
    </WrapItem>
  );
};

const Seasons = () => {
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const muted = useColorModeValue("gray.600", "gray.300");

  // 1) Hämta säsonger och välj aktiv
  const { data: seasons = [], loading: loadingSeasons } = useProfixioSeasons(ORG_ID);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [activeSeasonTab, setActiveSeasonTab] = useState(0);

  useEffect(() => {
    if (!loadingSeasons && Array.isArray(seasons) && seasons.length) {
      const firstId = seasons[0].id ?? seasons[0].code ?? seasons[0].seasonId ?? "";
      setSelectedSeasonId((prev) => prev || firstId);
      const idx = seasons.findIndex((s) => (s.id ?? s.code ?? s.seasonId) === (selectedSeasonId || firstId));
      if (idx >= 0) setActiveSeasonTab(idx);
    }
  }, [loadingSeasons, seasons, selectedSeasonId]);

  // 2) Turneringar i vald säsong
  const { data: seasonTournamentsRaw, loading: loadingTournaments } = useProfixioSeasonTournaments(selectedSeasonId, { sportId: "BB" });
  const seasonTournaments = useMemo(() => {
    if (Array.isArray(seasonTournamentsRaw)) return seasonTournamentsRaw;
    return seasonTournamentsRaw?.data || [];
  }, [seasonTournamentsRaw]);

  // 3) Sök + filtrering (distrikt/kategori + ålder/division + nivå från namn)
  const [query, setQuery] = useState("");
  const [districtId, setDistrictId] = useState(""); // categoryId
  const [divisionId, setDivisionId] = useState(""); // divisionId
  const [level, setLevel] = useState("");

  const districtOptions = useMemo(() => {
    const map = new Map();
    for (const t of seasonTournaments) {
      if (t?.categoryId && t?.categoryName && !map.has(t.categoryId)) {
        map.set(t.categoryId, t.categoryName);
      }
    }
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [seasonTournaments]);

  const divisionOptions = useMemo(() => {
    const map = new Map();
    for (const t of seasonTournaments) {
      if (districtId && t?.categoryId !== districtId) continue;
      if (t?.divisionId && t?.divisionName && !map.has(t.divisionId)) {
        map.set(t.divisionId, t.divisionName);
      }
    }
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [seasonTournaments, districtId]);

  // Helpers för nivåer
  const normalizeLevel = (s) => {
    if (!s) return "";
    const m = String(s).match(/niv[åa]\s*([0-9]+)/i); // fångar "Nivå 1", "Niva 2" etc.
    return m ? `Nivå ${m[1]}` : "";
  };

  const getLevelsFromTournament = React.useCallback((t) => {
    // Försök hitta nivå i flera fält
    const cands = [
      t?.levelName,        // ev. backend-fält
      t?.divisionLevel,    // ev. backend-fält
      t?.divisionName,     // ofta "Nivå X"
      t?.groupName,        // fallback om grupper innehåller nivå
      t?.name,             // sista utväg
    ].filter(Boolean);
    const levels = new Set();
    cands.forEach((c) => {
      const norm = normalizeLevel(c);
      if (norm) levels.add(norm);
    });
    return Array.from(levels);
  }, []);

  const levelOptions = useMemo(() => {
    const map = new Map();
    for (const t of seasonTournaments) {
      if (districtId && t?.categoryId !== districtId) continue;
      if (divisionId && t?.divisionId !== divisionId) continue;
      const lvls = getLevelsFromTournament(t);
      lvls.forEach((lvl) => {
        if (!map.has(lvl)) map.set(lvl, lvl);
      });
    }
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a,b) => {
      // sortera Nivå 1, 2, 3...
      const ai = parseInt((a.value.match(/\d+/)||[])[0] || "999", 10);
      const bi = parseInt((b.value.match(/\d+/)||[])[0] || "999", 10);
      return ai - bi || a.value.localeCompare(b.value, "sv");
    });
  }, [seasonTournaments, districtId, divisionId, getLevelsFromTournament]);

  // Group tournaments by Division (age) and Level ("Nivå X") so it mirrors Profixio layout
  const groupedByDivisionAndLevel = useMemo(() => {
    // First apply the same base filtering as the list view
    let base = seasonTournaments;
    if (districtId) base = base.filter((t) => t?.categoryId === districtId);
    if (divisionId) base = base.filter((t) => t?.divisionId === divisionId);
    if (level) {
      base = base.filter((t) => {
        const lvls = getLevelsFromTournament(t);
        return lvls.includes(level);
      });
    }
    if (query) {
      const q = query.toLowerCase();
      base = base.filter((t) => (t?.name || "").toLowerCase().includes(q));
    }

    // Build division → levels → tournaments
    const divMap = new Map();
    for (const t of base) {
      const divKey = t?.divisionId ?? "unknown";
      const divName = t?.divisionName ?? "Övrigt";
      if (!divMap.has(divKey)) {
        divMap.set(divKey, { id: divKey, name: divName, levels: new Map() });
      }
      const entry = divMap.get(divKey);

      const lvls = getLevelsFromTournament(t);
      // If no detected level put under "Övrig nivå"
      const names = lvls.length ? lvls : ["Övrig nivå"];

      names.forEach((lvlName) => {
        if (!entry.levels.has(lvlName)) entry.levels.set(lvlName, []);
        entry.levels.get(lvlName).push(t);
      });
    }

    // Convert maps to arrays and sort: divisions by name, levels by numeric index if possible
    const result = Array.from(divMap.values())
      .map((div) => {
        const levels = Array.from(div.levels, ([lvlName, items]) => ({
          level: lvlName,
          items: items.sort((a, b) => (a.name || "").localeCompare(b.name || "", "sv")),
        })).sort((a, b) => {
          const ai = parseInt((a.level.match(/\d+/) || [])[0] || "999", 10);
          const bi = parseInt((b.level.match(/\d+/) || [])[0] || "999", 10);
          return ai - bi || a.level.localeCompare(b.level, "sv");
        });
        return { ...div, levels };
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "sv"));

    return result;
  }, [seasonTournaments, districtId, divisionId, level, query, getLevelsFromTournament]);

  const filteredTournaments = useMemo(() => {
    let list = seasonTournaments;
    if (districtId) list = list.filter((t) => t?.categoryId === districtId);
    if (divisionId) list = list.filter((t) => t?.divisionId === divisionId);
    if (level) {
      list = list.filter((t) => {
        const lvls = getLevelsFromTournament(t);
        return lvls.includes(level);
      });
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((t) => (t?.name || "").toLowerCase().includes(q));
    }
    return list;
  }, [seasonTournaments, districtId, divisionId, level, query, getLevelsFromTournament]);

  const showTabs = Array.isArray(seasons) && seasons.length > 0;

  return (
    <Box p={4} bg={pageBg} minH="100%">
      {/* Sticky säsongsflikar */}
      <Box position="sticky" top="100px" zIndex={4} bg={pageBg} pb={4} pt={3} mb={6}>
        {showTabs && (
          <Tabs
            index={activeSeasonTab}
            onChange={(i) => {
              setActiveSeasonTab(i);
              const s = seasons[i];
              const raw = s?.id ?? s?.code ?? s?.seasonId ?? "";
              const sid = typeof raw === "string" ? Number(raw) || raw : raw;
              setSelectedSeasonId(sid);
              setDistrictId("");
              setDivisionId("");
              setLevel("");
              setQuery("");
            }}
            isFitted
            overflowX="auto"
            variant="soft-rounded"
            colorScheme="purple"
            size="sm"
          >
            <TabList overflowX="auto" overflowY="hidden" pb={1} css={{ scrollbarWidth: "thin" }}>
              {seasons.map((s) => {
                const sid = s.id ?? s.code ?? s.seasonId;
                const sname = s.name ?? s.code ?? String(sid);
                return (
                  <Tab key={sid} whiteSpace="nowrap" mr={2} px={4} borderRadius="full">
                    {sname}
                  </Tab>
                );
              })}
            </TabList>
          </Tabs>
        )}
      </Box>

      {/* Endast en (ren) högerkolumn kvar */}
      <Box bg={cardBg} borderRadius="xl" p={4} boxShadow="sm" minH="100px" mt="70px">
        <HStack justify="space-between" align="center" mb={5} spacing={3} flexWrap="nowrap">
          <Text fontSize="lg" fontWeight="700">
            Turneringar i säsongen
          </Text>
          <HStack spacing={3} flexWrap="nowrap">
            <Select
              placeholder="Välj distrikt"
              value={districtId}
              onChange={(e) => {
                setDistrictId(e.target.value ? Number(e.target.value) : "");
                setDivisionId("");
                setLevel("");
              }}
              size="sm"
              maxW="220px"
              borderRadius="full"
              bg="blue.50"
              variant="filled"
            >
              {districtOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Select
              placeholder="Välj ålder"
              value={divisionId}
              onChange={(e) => {
                setDivisionId(e.target.value ? Number(e.target.value) : "");
                setLevel("");
              }}
              size="sm"
              maxW="180px"
              isDisabled={divisionOptions.length === 0}
              borderRadius="full"
              bg="blue.50"
              variant="filled"
            >
              {divisionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Select
              placeholder="Välj nivå"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              size="sm"
              maxW="160px"
              isDisabled={levelOptions.length === 0}
              borderRadius="full"
              bg="blue.50"
              variant="filled"
            >
              {levelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Sök turnering…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              size="sm"
              maxW="220px"
              borderRadius="full"
              bg="blue.50"
              variant="filled"
            />
          </HStack>
        </HStack>

        {(districtId || divisionId || level) && (
          <HStack spacing={2} mb={3} flexWrap="wrap">
            {districtId && (
              <Tag size="sm" variant="subtle" colorScheme="purple" borderRadius="full">
                <TagLabel>
                  Distrikt: {districtOptions.find((d) => d.value === districtId)?.label}
                </TagLabel>
                <TagCloseButton onClick={() => setDistrictId("")} />
              </Tag>
            )}
            {divisionId && (
              <Tag size="sm" variant="subtle" colorScheme="purple" borderRadius="full">
                <TagLabel>Ålder: {divisionOptions.find((d) => d.value === divisionId)?.label}</TagLabel>
                <TagCloseButton onClick={() => setDivisionId("")} />
              </Tag>
            )}
            {level && (
              <Tag size="sm" variant="subtle" colorScheme="purple" borderRadius="full">
                <TagLabel>Nivå: {level}</TagLabel>
                <TagCloseButton onClick={() => setLevel("")} />
              </Tag>
            )}
          </HStack>
        )}

        {loadingTournaments ? (
          <HStack spacing={3} color={muted}>
            <Spinner size="sm" />
            <Text>Laddar turneringar…</Text>
          </HStack>
        ) : filteredTournaments.length === 0 ? (
          <Text color={muted} fontSize="sm">
            Inga turneringar matchade.
          </Text>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4} mt={2}>
            {groupedByDivisionAndLevel.map((div) => (
              <Box
                key={`div-${div.id}`}
                bg={cardBg}
                borderRadius="xl"
                p={4}
                boxShadow="md"
              >
                <HStack mb={3} spacing={3}>
                  <Text fontWeight="700">{div.name}</Text>
                  <Badge colorScheme="purple" variant="subtle">
                    {div.levels.reduce((acc, l) => acc + l.items.length, 0)} st
                  </Badge>
                </HStack>
                <SimpleGrid columns={{ base: 1 }} spacing={3}>
                  {div.levels.map((lvl) => (
                    <Box
                      key={`lvl-${div.id}-${lvl.level}`}
                      bg={pageBg}
                      borderRadius="lg"
                      p={3}
                      boxShadow="sm"
                    >
                      <HStack mb={2} spacing={3} justify="space-between" align="center">
                        <HStack spacing={3}>
                          <Text fontWeight="600">{lvl.level}</Text>
                          <Badge variant="outline" colorScheme="gray">{lvl.items.length}</Badge>
                        </HStack>
                      </HStack>
                      <Wrap spacing={2}>
                        {lvl.items.map((t) => (
                          <TournamentLink key={`pill-${t.id ?? t.code ?? t.name}`} t={t} />
                        ))}
                      </Wrap>
                    </Box>
                  ))}
                </SimpleGrid>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  );
};

export default Seasons;