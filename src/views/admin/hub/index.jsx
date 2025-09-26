import {
  Box,
  Flex,
  Icon,
  SimpleGrid,
  useColorModeValue,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Card,
  CardHeader,
  CardBody,
  Button,
} from "@chakra-ui/react";
// Custom components
import MiniStatistics from "components/card/MiniStatistics";
import IconBox from "components/icons/IconBox";
import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import {
  MdGroups,
  MdEventAvailable,
  MdSportsBasketball,
  MdEmojiEvents,
  MdCalendarToday,
  MdLayers,
  MdCheckroom,
  MdListAlt,
} from "react-icons/md";
import axios from "axios";
import { API_BASE } from "../../../config/apiBase";

// --- Local session cache helpers (JS) -----------------------------------------
const __CACHE_NS = 'hub-cache.v1';
const makeKey = (key, coachId, tenantId = 'single') => `${__CACHE_NS}::${tenantId}::${coachId || 'anon'}::${key}`;
const getCache = (fullKey) => {
  try {
    const raw = sessionStorage.getItem(fullKey);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== 'object') return null;
    const { ts, ttl, data } = entry;
    if (!ts || typeof ttl !== 'number') return null;
    if (Date.now() - ts > ttl) {
      sessionStorage.removeItem(fullKey);
      return null;
    }
    return data;
  } catch { return null; }
};
const setCache = (fullKey, data, ttlMs) => {
  try { sessionStorage.setItem(fullKey, JSON.stringify({ ts: Date.now(), ttl: ttlMs, data })); } catch {}
};
// -----------------------------------------------------------------------------

// DLT config via env (fallbacks)
const DLT_BUDGET = Number(process.env.REACT_APP_DLT_BUDGET) || 250000;
const DLT_CATEGORY_ID = process.env.REACT_APP_DLT_CATEGORY_ID || 'dlt'; // WooCommerce category slug/ID for DLT
const DLT_TAG_ID = process.env.REACT_APP_DLT_TAG_ID || null; // WooCommerce product tag id/slug for DLT

const DLT_SEASON_START = new Date(process.env.REACT_APP_DLT_SEASON_START || '2025-08-01T00:00:00');
const DLT_SEASON_END   = new Date(process.env.REACT_APP_DLT_SEASON_END   || '2026-08-01T23:59:59');

export default function UserReports() {
  // Chakra Color Mode
  const brandColor = useColorModeValue("brand.500", "white");
  const boxBg = useColorModeValue("secondaryGray.300", "whiteAlpha.100");

  const { accounts } = useMsal();
  const coachId = accounts?.[0]?.username || accounts?.[0]?.localAccountId || 'local-dev';
  const tenantId = process.env.REACT_APP_TENANT_ID || 'single';
  const KEY_AGG   = makeKey('dashboard/aggregates', coachId, tenantId);
  const KEY_MONTH = makeKey('dashboard/monthly', coachId, tenantId);
  const KEY_WEEK  = makeKey('dashboard/weekly', coachId, tenantId);
  const KEY_LATEST= makeKey('dashboard/latest', coachId, tenantId);
  const KEY_INS   = makeKey('dashboard/insights', coachId, tenantId);

  const [stats, setStats] = useState({
    moneyIn: 0,          // Totalt pengar in (DLT)
    budgetLeft: DLT_BUDGET,  // Kvar till budget
    playersTotal: 0,     // Antal anmälda spelare (DLT)
    boysCount: 0,        // Totalt anmälda killar
    girlsCount: 0,       // Totalt anmälda tjejer
    ordersCount: 0,      // Antal DLT-beställningar (denna månad)
    growth: 0,           // % tillväxt vs föregående månad (DLT)
  });

  const [monthlyData, setMonthlyData] = useState([]); // För TotalSpent graf {date, amount}
  const [weeklyData, setWeeklyData] = useState([]); // För WeeklyRevenue {day, amount}
  const [latestOrders, setLatestOrders] = useState([]);

  const [insights, setInsights] = useState({
    clubs: [],
    positions: [],
    birthYears: [],
    series: [],
    tshirts: [],
    products: [],
  });

  // ---- Helpers for DLT filtering ----
  const getDLTProductIds = async () => {
    try {
      // Helper: resolve category or tag slug -> numeric id
      const resolveIdFromSlug = async (type, raw) => {
        if (!raw) return null;
        // If already numeric, return as Number
        if (!isNaN(Number(raw))) return Number(raw);
        // Otherwise resolve by slug
        const endpoint =
          type === "category"
            ? `${API_BASE}/wc/products/categories`
            : `${API_BASE}/wc/products/tags`;
        const res = await axios.get(endpoint, { params: { slug: String(raw).trim() } });
        const match = Array.isArray(res.data) ? res.data.find((x) => x.slug === String(raw).trim()) : null;
        return match ? Number(match.id) : null;
      };

      let categoryId = null;
      let tagId = null;

      if (DLT_CATEGORY_ID) {
        categoryId = await resolveIdFromSlug("category", DLT_CATEGORY_ID);
      }
      if (!categoryId && DLT_TAG_ID) {
        tagId = await resolveIdFromSlug("tag", DLT_TAG_ID);
      }

      // If neither id is resolvable, we cannot pre-filter products; return null and fallback later.
      if (!categoryId && !tagId) return null;

      const params = { per_page: 100 };
      if (categoryId) params.category = categoryId;
      if (!categoryId && tagId) params.tag = tagId;

      const url = `${API_BASE}/wc/products`;
      const res = await axios.get(url, { params });
      return (res.data || []).map((p) => p.id);
    } catch (e) {
      console.error("Failed to load DLT product ids", e);
      return null;
    }
  };

  const isDLTLineItem = (item, dltProductIds) => {
    if (Array.isArray(dltProductIds) && dltProductIds.length) {
      return dltProductIds.includes(item.product_id);
    }
    // If we don't have product ids, try fuzzy match on name (last resort)
    const n = (item.name || "").toLowerCase();
    return n.includes("dlt");
  };

  const extractGenderFromMeta = (meta = []) => {
    const keyCandidates = ["dlt_kon","gender","kön","spelare_kön","player_gender","barnets kön","barnets_kön"];
    for (const m of meta) {
      const k = (m.key || "").toLowerCase();
      if (keyCandidates.includes(k)) {
        const v = String(m.value || "").toLowerCase();
        if (v.includes("pojke") || v.includes("kille") || v === "male" || v === "m") return "boy";
        if (v.includes("flicka") || v.includes("tjej") || v === "female" || v === "f") return "girl";
      }
    }
    return null;
  };

  const extractCampDateFromMeta = (meta = [], orderDate) => {
    const keyCandidates = ["lägerdatum","lagerdatum","camp_date","läger_datum","lager_datum","dlt_lagerdatum"];
    for (const m of meta) {
      const k = (m.key || "").toLowerCase();
      if (keyCandidates.includes(k)) {
        const v = String(m.value || "").trim();
        if (v) return v;
      }
    }
    // fallback to order created date
    try {
      return new Date(orderDate).toLocaleDateString('sv-SE');
    } catch {
      return "";
    }
  };

  // -----------------------------------
  const getMetaValue = (meta = [], keys = []) => {
    const lc = keys.map((k) => String(k).toLowerCase());
    for (const m of meta) {
      const k = String(m?.key || "").toLowerCase();
      if (lc.includes(k)) {
        const v = String(m?.value ?? "").trim();
        if (v) return v;
      }
    }
    return "";
  };

  const tallyByMeta = (orders, keys) => {
    const map = new Map();
    (orders || []).forEach((o) => {
      const val = getMetaValue(o.meta_data || [], keys) || "Okänt";
      // viktning per spelare = summera kvantitet i orderns DLT-rader
      const qty = (o.line_items || []).reduce((q, li) => q + (li.quantity || 0), 0) || 1;
      map.set(val, (map.get(val) || 0) + qty);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  };

  const tallyByProduct = (orders) => {
    const map = new Map();
    (orders || []).forEach((o) => {
      (o.line_items || []).forEach((li) => {
        const name = String(li.name || "Okänt");
        const qty = Number(li.quantity || 0);
        map.set(name, (map.get(name) || 0) + qty);
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  };

  const sumDLT = (orders) =>
    orders.reduce((acc, o) =>
      acc +
      (o.line_items || []).reduce((s, li) => {
        // use line-item total (after discounts). Fallback to subtotal.
        const liTotal = parseFloat(li.total ?? li.subtotal ?? 0);
        return s + (isNaN(liTotal) ? 0 : liTotal);
      }, 0)
    , 0);

  // ---- WooCommerce pagination helper (fetch all pages) ----
  const fetchAllOrders = async (params) => {
    const per_page = 100;
    let page = 1;
    let all = [];
    for (;;) {
      const { data } = await axios.get(`${API_BASE}/wc/orders`, {
        params: { ...params, per_page, page },
      });
      const batch = Array.isArray(data) ? data : [];
      all = all.concat(batch);
      if (batch.length < per_page) break;
      page += 1;
      if (page > 50) break; // safety guard
    }
    return all;
  };
  // --------------------------------------------------------

  // ---- Formatting helpers ----
  const fmtInt = (n) => {
    if (n === null || n === undefined || isNaN(Number(n))) return "0";
    return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Number(n));
  };
  // ----------------------------

  useEffect(() => {
    // Prime state from cache for instant paint
    try {
      const cAgg = getCache(KEY_AGG);
      if (cAgg) setStats(cAgg);
      const cMon = getCache(KEY_MONTH);
      if (cMon) setMonthlyData(cMon);
      const cWeek = getCache(KEY_WEEK);
      if (cWeek) setWeeklyData(cWeek);
      const cLatest = getCache(KEY_LATEST);
      if (cLatest) setLatestOrders(cLatest);
      const cIns = getCache(KEY_INS);
      if (cIns) setInsights(cIns);
    } catch {}
    const fetchData = async () => {
      try {
        const today = new Date();
        // Season window: Aug 1, 2025 -> Aug 1, 2026 (configurable via env)
        const seasonStart = DLT_SEASON_START;
        const seasonEnd = DLT_SEASON_END;
        // Month window for "denna månad" KPIs
        const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        const dltProductIds = await getDLTProductIds();

        // Pull orders for current month and year (completed & processing)
        const commonParams = { status: 'completed,processing' };

        const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);

        const [ordersThisMonthRaw, ordersSeasonRaw, ordersPrevMonthRaw] = await Promise.all([
          fetchAllOrders({ ...commonParams, after: firstDayMonth.toISOString(), before: lastDayMonth.toISOString() }),
          fetchAllOrders({ ...commonParams, after: seasonStart.toISOString(),   before: seasonEnd.toISOString()   }),
          fetchAllOrders({ ...commonParams, after: prevStart.toISOString(),     before: prevEnd.toISOString()     }),
        ]);

        const onlyDLTLineItems = (orders) => {
          return (orders || []).map(o => {
            const dltItems = (o.line_items || []).filter(li => isDLTLineItem(li, dltProductIds));
            return { ...o, line_items: dltItems };
          }).filter(o => (o.line_items || []).length > 0);
        };

        const ordersThisMonth = onlyDLTLineItems(ordersThisMonthRaw);
        const ordersSeason = onlyDLTLineItems(ordersSeasonRaw);
        const ordersPrevMonth = onlyDLTLineItems(ordersPrevMonthRaw);

        // --- Aggregations ---
        const countPlayers = (orders) => orders.reduce((acc, o) => {
          const qty = (o.line_items || []).reduce((q, li) => q + (li.quantity || 0), 0);
          return acc + qty;
        }, 0);

        const moneyInSeason = sumDLT(ordersSeason);
        const budgetLeft = Math.max(DLT_BUDGET - moneyInSeason, 0);

        // gender counts (best-effort)
        let boys = 0, girls = 0;
        ordersSeason.forEach(o => {
          const g = extractGenderFromMeta(o.meta_data || []);
          if (g === "boy") boys += 1;
          else if (g === "girl") girls += 1;
        });

        const playersThisMonth = countPlayers(ordersThisMonth);
        const playersSeason = countPlayers(ordersSeason);

        const salesThisMonth = sumDLT(ordersThisMonth);
        const salesPrevMonth = sumDLT(ordersPrevMonth);
        const growth = salesPrevMonth > 0 ? (((salesThisMonth - salesPrevMonth) / salesPrevMonth) * 100).toFixed(2) : 0;

        setStats({
          moneyIn: moneyInSeason,
          budgetLeft: budgetLeft,
          playersTotal: playersSeason,
          boysCount: boys,
          girlsCount: girls,
          ordersCount: ordersThisMonth.length,
          growth
        });

        // Charts data (month/day)
        const dailySales = {};
        ordersThisMonth.forEach(order => {
          const date = (order.date_created || '').split('T')[0];
          if (!date) return;
          dailySales[date] = (dailySales[date] || 0) + parseFloat(order.total || 0);
        });
        const monthly = Object.keys(dailySales).map(date => ({ date, amount: dailySales[date] }));
        setMonthlyData(monthly.sort((a, b) => new Date(a.date) - new Date(b.date)));

        const firstDayWeek = new Date(today);
        firstDayWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
        const weeklySales = {};
        for (let i = 0; i < 7; i++) {
          const day = new Date(firstDayWeek);
          day.setDate(firstDayWeek.getDate() + i);
          weeklySales[day.getDate()] = 0;
        }
        ordersThisMonth.filter(order => new Date(order.date_created) >= firstDayWeek).forEach(order => {
          const day = new Date(order.date_created).getDate();
          weeklySales[day] = (weeklySales[day] || 0) + parseFloat(order.total || 0);
        });
        const weekly = Object.keys(weeklySales).map(day => ({ day: parseInt(day, 10), amount: weeklySales[day] }));
        setWeeklyData(weekly.sort((a, b) => a.day - b.day));

        // Save latest DLT orders to state for the table
        setLatestOrders(ordersThisMonth.sort((a, b) => new Date(b.date_created) - new Date(a.date_created)));

        // Insights aggregations
        const clubs = tallyByMeta(ordersSeason, ["dlt_klubblag", "klubblag", "klubb"]);
        const positions = tallyByMeta(ordersSeason, ["dlt_basket_position", "position", "basket_position"]);
        const birthYears = tallyByMeta(ordersSeason, ["dlt_alderspelare", "fodelsear", "födelseår", "ar_du_ar_fodd"]);
        const series = tallyByMeta(ordersSeason, ["dlt_aktuellserie", "aktuellserie", "serie"]);
        const tshirts = tallyByMeta(ordersSeason, ["dlt_tshirt", "tshirt", "t-shirt", "storlek"]);
        const products = tallyByProduct(ordersSeason);
        setInsights({ clubs, positions, birthYears, series, tshirts, products });
        // ---- Cache writes ----
        setCache(KEY_AGG, {
          moneyIn: moneyInSeason,
          budgetLeft: budgetLeft,
          playersTotal: playersSeason,
          boysCount: boys,
          girlsCount: girls,
          ordersCount: ordersThisMonth.length,
          growth
        }, 10 * 60 * 1000);
        setCache(KEY_MONTH, monthly.sort((a, b) => new Date(a.date) - new Date(b.date)), 5 * 60 * 1000);
        setCache(KEY_WEEK, weekly.sort((a, b) => a.day - b.day), 5 * 60 * 1000);
        setCache(KEY_LATEST, ordersThisMonth.sort((a, b) => new Date(b.date_created) - new Date(a.date_created)), 3 * 60 * 1000);
        setCache(KEY_INS, { clubs, positions, birthYears, series, tshirts, products }, 10 * 60 * 1000);
      } catch (err) {
        console.error('Failed to load DLT dashboard stats:', err);
      }
    };
    fetchData();
  }, []);

  const SmallTopList = ({ title, items, icon, iconBg = "secondaryGray.300", iconColor = "brand.500", limit = 5 }) => (
    <Card>
      <CardHeader pb="8px">
        <Flex align="center" gap="10px">
          <IconBox
            w="40px"
            h="40px"
            bg={iconBg}
            icon={<Icon as={icon || MdListAlt} w="22px" h="22px" color={iconColor} />}
          />
          <Text fontSize="md" fontWeight="700">{title}</Text>
        </Flex>
      </CardHeader>
      <CardBody pt="0">
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th>Värde</Th>
              <Th isNumeric>Antal</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(items || []).slice(0, limit).map(([label, count]) => (
              <Tr key={label}>
                <Td maxW="240px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{label}</Td>
                <Td isNumeric>{count}</Td>
              </Tr>
            ))}
            {(!items || items.length === 0) && (
              <Tr><Td colSpan={2}><Text color="secondaryGray.600">Ingen data ännu</Text></Td></Tr>
            )}
          </Tbody>
        </Table>
      </CardBody>
    </Card>
  );

  const LatestDLTRegistrations = ({ orders }) => {
    return (
      <Card>
        <CardHeader>
          <Text fontSize="xl" fontWeight="bold" color="black">Senaste DLT-anmälningar</Text>
          <Text fontSize="sm" color="gray.500">Senaste registreringar i Webbshop"</Text>
        </CardHeader>
        <CardBody>
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Order ID#</Th>
                <Th>Köpdatum</Th>
                <Th>Föräldrar</Th>
                <Th>Kön</Th>
                <Th>Produkt - Variant</Th>
                <Th isNumeric>Summa</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(orders || []).slice(0, 10).map((o) => {
                const gender = extractGenderFromMeta(o.meta_data || []) || "";
                const campDate = extractCampDateFromMeta(o.meta_data || [], o.date_created);
                const productNames = (o.line_items || []).map(li => li.name).join(", ");
                return (
                  <Tr key={o.id}>
                    <Td>{o.id}</Td>
                    <Td>{campDate}</Td>
                    <Td>{`${o?.billing?.first_name || ""} ${o?.billing?.last_name || ""}`.trim()}</Td>
                    <Td textTransform="capitalize">{gender}</Td>
                    <Td maxW="360px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{productNames}</Td>
                    <Td isNumeric>{parseFloat(o.total || 0).toFixed(2)} kr</Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </CardBody>
      </Card>
    );
  };

  return (
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }}>
      <Flex justify="flex-end" mb="8px">
        <Button size="sm" variant="outline" onClick={() => {
          try {
            [KEY_AGG, KEY_MONTH, KEY_WEEK, KEY_LATEST, KEY_INS].forEach(k => sessionStorage.removeItem(k));
          } catch {}
          // Re-run fetch
          (async () => {
            try {
              const today = new Date();
              const seasonStart = DLT_SEASON_START;
              const seasonEnd = DLT_SEASON_END;
              const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              const lastDayMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
              const dltProductIds = await getDLTProductIds();
              const commonParams = { status: 'completed,processing' };
              const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
              const [ordersThisMonthRaw, ordersSeasonRaw, ordersPrevMonthRaw] = await Promise.all([
                fetchAllOrders({ ...commonParams, after: firstDayMonth.toISOString(), before: lastDayMonth.toISOString() }),
                fetchAllOrders({ ...commonParams, after: seasonStart.toISOString(),   before: seasonEnd.toISOString()   }),
                fetchAllOrders({ ...commonParams, after: prevStart.toISOString(),     before: prevEnd.toISOString()     }),
              ]);
              const onlyDLTLineItems = (orders) => {
                return (orders || []).map(o => {
                  const dltItems = (o.line_items || []).filter(li => isDLTLineItem(li, dltProductIds));
                  return { ...o, line_items: dltItems };
                }).filter(o => (o.line_items || []).length > 0);
              };
              const ordersThisMonth = onlyDLTLineItems(ordersThisMonthRaw);
              const ordersSeason = onlyDLTLineItems(ordersSeasonRaw);
              const ordersPrevMonth = onlyDLTLineItems(ordersPrevMonthRaw);
              const countPlayers = (orders) => orders.reduce((acc, o) => acc + (o.line_items||[]).reduce((q, li) => q + (li.quantity||0), 0), 0);
              const moneyInSeason = sumDLT(ordersSeason);
              const budgetLeft = Math.max(DLT_BUDGET - moneyInSeason, 0);
              let boys = 0, girls = 0;
              ordersSeason.forEach(o => { const g = extractGenderFromMeta(o.meta_data || []); if (g === 'boy') boys += 1; else if (g === 'girl') girls += 1; });
              const playersSeason = countPlayers(ordersSeason);
              const salesThisMonth = sumDLT(ordersThisMonth);
              const salesPrevMonth = sumDLT(ordersPrevMonth);
              const growth = salesPrevMonth > 0 ? (((salesThisMonth - salesPrevMonth) / salesPrevMonth) * 100).toFixed(2) : 0;
              setStats({ moneyIn: moneyInSeason, budgetLeft, playersTotal: playersSeason, boysCount: boys, girlsCount: girls, ordersCount: ordersThisMonth.length, growth });
              const dailySales = {};
              ordersThisMonth.forEach(order => {
                const date = (order.date_created || '').split('T')[0];
                if (!date) return;
                dailySales[date] = (dailySales[date] || 0) + parseFloat(order.total || 0);
              });
              const monthly = Object.keys(dailySales).map(date => ({ date, amount: dailySales[date] })).sort((a, b) => new Date(a.date) - new Date(b.date));
              setMonthlyData(monthly);
              const firstDayWeek = new Date(today); firstDayWeek.setDate(today.getDate() - today.getDay() + 1);
              const weeklySales = {}; for (let i = 0; i < 7; i++) { const d = new Date(firstDayWeek); d.setDate(firstDayWeek.getDate() + i); weeklySales[d.getDate()] = 0; }
              ordersThisMonth.filter(order => new Date(order.date_created) >= firstDayWeek).forEach(order => {
                const day = new Date(order.date_created).getDate();
                weeklySales[day] = (weeklySales[day] || 0) + parseFloat(order.total || 0);
              });
              const weekly = Object.keys(weeklySales).map(day => ({ day: parseInt(day, 10), amount: weeklySales[day] })).sort((a, b) => a.day - b.day);
              setWeeklyData(weekly);
              setLatestOrders(ordersThisMonth.sort((a, b) => new Date(b.date_created) - new Date(a.date_created)));
              const clubs = tallyByMeta(ordersSeason, ["dlt_klubblag", "klubblag", "klubb"]);
              const positions = tallyByMeta(ordersSeason, ["dlt_basket_position", "position", "basket_position"]);
              const birthYears = tallyByMeta(ordersSeason, ["dlt_alderspelare", "fodelsear", "födelseår", "ar_du_ar_fodd"]);
              const series = tallyByMeta(ordersSeason, ["dlt_aktuellserie", "aktuellserie", "serie"]);
              const tshirts = tallyByMeta(ordersSeason, ["dlt_tshirt", "tshirt", "t-shirt", "storlek"]);
              const products = tallyByProduct(ordersSeason);
              setInsights({ clubs, positions, birthYears, series, tshirts, products });
              // write caches
              setCache(KEY_AGG, { moneyIn: moneyInSeason, budgetLeft, playersTotal: playersSeason, boysCount: boys, girlsCount: girls, ordersCount: ordersThisMonth.length, growth }, 10*60*1000);
              setCache(KEY_MONTH, monthly, 5*60*1000);
              setCache(KEY_WEEK, weekly, 5*60*1000);
              setCache(KEY_LATEST, ordersThisMonth.sort((a, b) => new Date(b.date_created) - new Date(a.date_created)), 3*60*1000);
              setCache(KEY_INS, { clubs, positions, birthYears, series, tshirts, products }, 10*60*1000);
            } catch (e) { console.error(e); }
          })();
        }}>Uppdatera</Button>
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} gap='16px' mb='16px'>
        {/* 1: Toppklubbar */}
        <SmallTopList
          title="Toppklubbar"
          items={insights.clubs}
          icon={MdSportsBasketball}
          iconBg="linear-gradient(90deg, #E0E7FF 0%, #EEF2FF 100%)"
          iconColor={brandColor}
          limit={4}
        />
        {/* 2: Positioner */}
        <SmallTopList
          title="Positioner"
          items={insights.positions}
          icon={MdLayers}
          iconBg="linear-gradient(90deg, #DCFCE7 0%, #ECFDF5 100%)"
          iconColor={brandColor}
          limit={4}
        />
        {/* 3: Födelseår */}
        <SmallTopList
          title="Födelseår"
          items={insights.birthYears}
          icon={MdCalendarToday}
          iconBg="linear-gradient(90deg, #FEF9C3 0%, #FFFBEB 100%)"
          iconColor={brandColor}
          limit={4}
        />
        {/* 4: Antal anmälda spelare */}
        <MiniStatistics
          startContent={
            <IconBox
              w='56px'
              h='56px'
              bg={boxBg}
              icon={<Icon w='32px' h='32px' as={MdGroups} color={brandColor} />}
            />
          }
          growth={`${stats.growth}%`}
          name='Antal anmälda spelare'
          value={stats.playersTotal}
        />
        {/* 5: Totalt anmälda killar */}
        <MiniStatistics
          startContent={
            <IconBox
              w='56px'
              h='56px'
              bg={boxBg}
              icon={<Icon w='32px' h='32px' as={MdGroups} color={brandColor} />}
            />
          }
          name='Totalt anmälda killar'
          value={stats.boysCount}
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} gap='16px' mb='16px'>
        {/* Rad 2: 3 stora rutor + 2 statistik-kort till höger */}
        <SmallTopList
          title="Aktuell serie"
          items={insights.series}
          icon={MdEmojiEvents}
          iconBg="linear-gradient(90deg, #FFE4E6 0%, #FFF1F2 100%)"
          iconColor={brandColor}
          limit={4}
        />
        <SmallTopList
          title="T‑shirt storlekar"
          items={insights.tshirts}
          icon={MdCheckroom}
          iconBg="linear-gradient(90deg, #F0FDFA 0%, #ECFEFF 100%)"
          iconColor={brandColor}
          limit={4}
        />
        <SmallTopList
          title="Könsfördelning"
          items={[["Killar", stats.boysCount],["Tjejer", stats.girlsCount]]}
          icon={MdGroups}
          iconBg="linear-gradient(90deg, #E0E7FF 0%, #EEF2FF 100%)"
          iconColor={brandColor}
          limit={2}
        />
        <MiniStatistics
          startContent={
            <IconBox
              w='56px'
              h='56px'
              bg={boxBg}
              icon={<Icon w='32px' h='32px' as={MdGroups} color={brandColor} />}
            />
          }
          name='Totalt anmälda tjejer'
          value={stats.girlsCount}
        />
        <MiniStatistics
          startContent={
            <IconBox
              w='56px'
              h='56px'
              bg={boxBg}
              icon={<Icon w='32px' h='32px' as={MdEventAvailable} color={brandColor} />}
            />
          }
          name='Nya anmälningar (denna månad)'
          value={stats.ordersCount}
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 1 }} gap='20px' mb='20px'>
        <LatestDLTRegistrations orders={latestOrders} />
      </SimpleGrid>
    </Box>
  );
}