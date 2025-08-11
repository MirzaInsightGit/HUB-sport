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
        size="sm"
        variant="outline"
        borderRadius="full"
        px={4}
        py={2}
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

  const getLevelFromName = (name) => {
    const m = /(nivå\s*\d+)/i.exec(name || "");
    return m ? m[1].replace(/\s+/g, " ") : null;
  };

  const levelOptions = useMemo(() => {
    const map = new Map();
    for (const t of seasonTournaments) {
      if (districtId && t?.categoryId !== districtId) continue;
      if (divisionId && t?.divisionId !== divisionId) continue;
      const lvl = getLevelFromName(t?.name);
      if (lvl && !map.has(lvl)) map.set(lvl, lvl);
    }
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [seasonTournaments, districtId, divisionId]);

  const filteredTournaments = useMemo(() => {
    let list = seasonTournaments;
    if (districtId) list = list.filter((t) => t?.categoryId === districtId);
    if (divisionId) list = list.filter((t) => t?.divisionId === divisionId);
    if (level) list = list.filter((t) => getLevelFromName(t?.name) === level);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((t) => (t?.name || "").toLowerCase().includes(q));
    }
    return list;
  }, [seasonTournaments, districtId, divisionId, level, query]);

  const showTabs = Array.isArray(seasons) && seasons.length > 0;

  return (
    <Box p={4} bg={pageBg} minH="100%">
      {/* Sticky säsongsflikar */}
      <Box position="sticky" top="0" zIndex={5} bg={pageBg} pb={3} pt={2} mb={2}>
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
      <Box bg={cardBg} borderRadius="xl" p={4} boxShadow="sm" minH="400px">
        <HStack justify="space-between" align="center" mb={4} spacing={3} flexWrap="nowrap">
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
              isDisabled={!districtId && divisionOptions.length === 0}
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
          <Wrap spacing={3}>
            {filteredTournaments.map((t) => (
              <TournamentLink key={`list-${t.id ?? t.code ?? t.name}`} t={t} />
            ))}
          </Wrap>
        )}
      </Box>
    </Box>
  );
};

export default Seasons;