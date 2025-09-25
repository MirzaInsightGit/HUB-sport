import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Text,
  Flex,
  Progress,
  HStack,
  Button,
  ButtonGroup,
  Input,
  Stack,
  Badge,
  useToast,
  SimpleGrid,
  GridItem,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Icon,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useColorModeValue,
} from "@chakra-ui/react";
import { MdPaid, MdSavings, MdGroups, MdInventory, MdWarningAmber } from "react-icons/md";
import axios from "axios";
import IconBox from 'components/icons/IconBox';
import { API_BASE } from "../../config/apiBase";

// ===== Dashboard-paritet: konstanter & helpers =====
const DLT_BUDGET = Number(process.env.REACT_APP_DLT_BUDGET) || 250000;
const DLT_CATEGORY_ID = process.env.REACT_APP_DLT_CATEGORY_ID || 'dlt';
const DLT_TAG_ID = process.env.REACT_APP_DLT_TAG_ID || null;
const DLT_SEASON_START = new Date(process.env.REACT_APP_DLT_SEASON_START || '2025-08-01T00:00:00');
const DLT_SEASON_END   = new Date(process.env.REACT_APP_DLT_SEASON_END   || '2026-08-01T23:59:59');

const getDLTProductIds = async () => {
  try {
    const resolveIdFromSlug = async (type, raw) => {
      if (!raw) return null;
      if (!isNaN(Number(raw))) return Number(raw);
      const endpoint = type === 'category' ? `${API_BASE}/wc/products/categories` : `${API_BASE}/wc/products/tags`;
      const res = await axios.get(endpoint, { params: { slug: String(raw).trim() } });
      const match = Array.isArray(res.data) ? res.data.find((x) => x.slug === String(raw).trim()) : null;
      return match ? Number(match.id) : null;
    };
    let categoryId = null; let tagId = null;
    if (DLT_CATEGORY_ID) categoryId = await resolveIdFromSlug('category', DLT_CATEGORY_ID);
    if (!categoryId && DLT_TAG_ID) tagId = await resolveIdFromSlug('tag', DLT_TAG_ID);
    if (!categoryId && !tagId) return null;
    const params = { per_page: 100 };
    if (categoryId) params.category = categoryId;
    if (!categoryId && tagId) params.tag = tagId;
    const url = `${API_BASE}/wc/products`;
    const res = await axios.get(url, { params });
    return (res.data || []).map((p) => p.id);
  } catch (e) {
    console.error('Failed to load DLT product ids', e);
    return null;
  }
};

const isDLTLineItem = (item, dltProductIds) => {
  if (Array.isArray(dltProductIds) && dltProductIds.length) {
    return dltProductIds.includes(item.product_id);
  }
  const n = (item.name || '').toLowerCase();
  return n.includes('dlt');
};

const fetchAllOrders = async (params) => {
  const per_page = 100; let page = 1; let all = [];
  for (;;) {
    const { data } = await axios.get(`${API_BASE}/wc/orders`, { params: { ...params, per_page, page } });
    const batch = Array.isArray(data) ? data : [];
    all = all.concat(batch);
    if (batch.length < per_page) break;
    page += 1;
    if (page > 50) break; // safety guard
  }
  return all;
};

const sumDLT = (orders) => orders.reduce((acc, o) => acc + (o.line_items || []).reduce((s, li) => {
  const liTotal = parseFloat(li.total ?? li.subtotal ?? 0);
  return s + (isNaN(liTotal) ? 0 : liTotal);
}, 0), 0);

const countPlayers = (orders) => orders.reduce((acc, o) => acc + (o.line_items || []).reduce((q, li) => q + (li.quantity || 0), 0), 0);
// =====================================================

function StatCard({ label, value, helper, icon, iconElement, accent, bg, textColor }) {
  return (
    <Card borderRadius="2xl" bg={bg}>
      <CardBody>
        <Flex align="center" gap={3}>
          {(icon || iconElement) && (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              w={10}
              h={10}
              borderRadius="full"
              bg={accent || "blackAlpha.100"}
            >
              {iconElement || <Icon as={icon} />}
            </Box>
          )}
          <Box>
            <Text fontSize="sm" color={textColor}>
              {label}
            </Text>
            <Text fontSize="2xl" fontWeight="semibold" color={textColor}>
              {value}
            </Text>
            {helper && (
              <Text fontSize="xs" color={textColor}>
                {helper}
              </Text>
            )}
            {typeof accent === 'number' && (
              <Progress value={Math.max(0, Math.min(100, accent))} borderRadius="md" size="xs" mt={2} />
            )}
          </Box>
        </Flex>
      </CardBody>
    </Card>
  );
}

const formatCurrency = (sek) =>
  sek == null
    ? "—"
    : new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(sek);

function FinanceCard({ label, value, icon, cardBg, boxBg, brandColor, textColor }) {
  return (
    <Card borderRadius="2xl" bg={cardBg}>
      <CardBody>
        <Flex align="center" gap={4}>
          <IconBox
            w='56px'
            h='56px'
            bg={boxBg}
            icon={<Icon as={icon} w='32px' h='32px' color={brandColor} />}
          />
          <Box>
            <Text fontSize="sm" color={textColor}>{label}</Text>
            <Text fontSize="2xl" fontWeight="semibold" color={textColor}>{value}</Text>
          </Box>
        </Flex>
      </CardBody>
    </Card>
  );
}

export default function Economy() {
  const toast = useToast();
  const [goal, setGoal] = useState(300); // säsongsmål (editabelt)
  const [current, setCurrent] = useState(0); // nuvarande antal spelare
  const [saving, setSaving] = useState(false);
  const [variants, setVariants] = useState([]); // WC-variationer med lager
  const [finance, setFinance] = useState({ earned: 0, budgetAnnual: 250000, budgetLeft: null });
  const [ordersThisMonthCount, setOrdersThisMonthCount] = useState(0);
  const [fullPercent, setFullPercent] = useState(0);
  const [capacityTotal, setCapacityTotal] = useState(0);
  const [period, setPeriod] = useState('season'); // 'season' | 'month'
  const [sparkData, setSparkData] = useState([]); // [{x: ISO date string, y: amount}]
  const percent = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;

  // Chart helpers
  const [hoverIdx, setHoverIdx] = useState(null);
  const fmtDate = (s) => {
    try { return new Date(s).toLocaleDateString('sv-SE', { day: '2-digit', month: '2-digit' }); } catch { return s; }
  };
  const fmtInt = (n) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(n||0));

  const brandColor = useColorModeValue('brand.500', 'white');
  const boxBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.200');
  const cardBg = useColorModeValue('white', 'navy.700');
  const textColor = useColorModeValue('secondaryGray.900', 'white');

  // Aggregerade WC-metrics
  const { totalLeft, soldOutCount, lowCount } = useMemo(() => {
    const left = variants.reduce((sum, v) => sum + (typeof v.left === "number" ? v.left : 0), 0);
    const soldOut = variants.filter((v) => (v.left ?? 0) === 0).length;
    const low = variants.filter((v) => (v.left ?? 0) > 0 && v.left <= 5).length;
    return { totalLeft: left, soldOutCount: soldOut, lowCount: low };
  }, [variants]);

  useEffect(() => {
    // Hämta säsongsmål (admin settings)
    try {
      const g = Number(localStorage.getItem('economy:seasonGoal'));
      if (!isNaN(g) && g > 0) setGoal(g);
    } catch {}

    // Hämta nuvarande antal spelare
    (async () => {
      try {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
        const rangeStart = period === 'month' ? monthStart : DLT_SEASON_START;
        const rangeEnd   = period === 'month' ? monthEnd   : DLT_SEASON_END;

        const dltProductIds = await getDLTProductIds();
        const commonParams = { status: 'completed,processing' };

        const [ordersRangeRaw, ordersThisMonthRaw] = await Promise.all([
          fetchAllOrders({ ...commonParams, after: rangeStart.toISOString(), before: rangeEnd.toISOString() }),
          fetchAllOrders({ ...commonParams, after: monthStart.toISOString(), before: monthEnd.toISOString() }),
        ]);

        const onlyDLTLineItems = (orders) => {
          return (orders || []).map(o => {
            const dltItems = (o.line_items || []).filter(li => isDLTLineItem(li, dltProductIds));
            return { ...o, line_items: dltItems };
          }).filter(o => (o.line_items || []).length > 0);
        };

        const ordersRange = onlyDLTLineItems(ordersRangeRaw);
        const ordersThisMonth = onlyDLTLineItems(ordersThisMonthRaw);

        // Sparkline data
        const daily = {};
        (period === 'month' ? ordersThisMonth : ordersRange).forEach(o => {
          const date = (o.date_created || '').slice(0,10);
          if (!date) return;
          const amt = (o.line_items || []).reduce((s, li) => s + parseFloat(li.total ?? li.subtotal ?? 0), 0);
          daily[date] = (daily[date] || 0) + amt;
        });
        const spark = Object.keys(daily).sort().map(d => ({ x: d, y: daily[d] }));
        setSparkData(spark);

        // Finance
        const moneyInSeason = sumDLT(ordersRange);
        const budgetLeft = Math.max(DLT_BUDGET - moneyInSeason, 0);
        setFinance({ earned: moneyInSeason, budgetAnnual: DLT_BUDGET, budgetLeft });

        // Players
        const playersRange = countPlayers(ordersRange);
        const playersThisMonth = countPlayers(ordersThisMonth);
        setCurrent(playersRange);
        setOrdersThisMonthCount(ordersThisMonth.length);

        // Capacity (WC) – remaining seats per variant
        const productIds = dltProductIds || [];
        const items = [];
        for (const pid of productIds) {
          try {
            const { data: vars } = await axios.get(`${API_BASE}/wc/products/${pid}/variations`, { params: { per_page: 100 } });
            (vars || []).forEach(v => {
              const label = (v.attributes || []).map(a => a.option).filter(Boolean).join(' / ') || v.sku || v.id;
              const left = v.manage_stock ? (v.stock_quantity ?? 0) : (v.stock_status === 'instock' ? 0 : 0);
              items.push({ productId: pid, variationId: v.id, label, left, status: v.stock_status });
            });
          } catch {}
        }
        items.sort((a,b) => a.left - b.left);
        const leftSum = items.reduce((sum, v) => sum + (typeof v.left === 'number' ? v.left : 0), 0);
        const capTotal = leftSum + playersRange;
        setCapacityTotal(capTotal);
        setFullPercent(capTotal > 0 ? Math.round((playersRange / capTotal) * 100) : 0);
        setVariants(items);
      } catch (e) {
        console.error('Economy data load failed', e);
      }
    })();
  }, [toast, period]);

  const saveGoal = async () => {
    setSaving(true);
    try {
      const v = Number(goal);
      if (isNaN(v) || v <= 0) throw new Error('Ogiltigt mål');
      localStorage.setItem('economy:seasonGoal', String(v));
      setGoal(v);
      toast({ status: 'success', title: 'Mål sparat lokalt' });
    } catch (e) {
      toast({ status: 'error', title: 'Kunde inte spara målet' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={6}>
      <Heading size="lg" color={textColor}>Ekonomi & Kapacitet</Heading>

      {/* Liten toppmarginal som på startsidan */}
      <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
        <Flex justify="space-between" align="center" mb={3}>
          <Box />
          <HStack>
            <Text color={textColor} fontSize="sm" mr={2}>Period</Text>
            <ButtonGroup size="sm" isAttached variant="outline">
              <Button onClick={() => setPeriod('month')} colorScheme={period === 'month' ? 'brand' : 'gray'}>Denna månad</Button>
              <Button onClick={() => setPeriod('season')} colorScheme={period === 'season' ? 'brand' : 'gray'}>Säsong</Button>
            </ButtonGroup>
          </HStack>
        </Flex>
        <Tabs variant="soft-rounded" colorScheme="gray">
          <TabList gap={2}>
            <Tab borderRadius="full" px={5} fontWeight="semibold">Översikt</Tab>
            <Tab borderRadius="full" px={5} fontWeight="semibold">Intäkter & Budget</Tab>
            <Tab borderRadius="full" px={5} fontWeight="semibold">Kapacitet (WC)</Tab>
          </TabList>

          <TabPanels mt={4}>
            {/* Översikt */}
            <TabPanel>
              <Stack spacing={6}>
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3, xl: 6 }} spacing={4}>
                  <StatCard label="Säsongsmål" value={goal} helper="Nya spelare" textColor={textColor} bg={cardBg}
                    iconElement={<IconBox w='40px' h='40px' bg={boxBg} icon={<Icon as={MdSavings} w='22px' h='22px' color={brandColor} />} />} />
                  <StatCard label="Anmälda spelare" value={current} textColor={textColor} bg={cardBg}
                    iconElement={<IconBox w='40px' h='40px' bg={boxBg} icon={<Icon as={MdGroups} w='22px' h='22px' color={brandColor} />} />} />
                  <StatCard label="Uppnått" value={`${percent}%`} helper={`${current} / ${goal}`} textColor={textColor} bg={cardBg}
                    iconElement={<IconBox w='40px' h='40px' bg={boxBg} icon={<Icon as={MdSavings} w='22px' h='22px' color={brandColor} />} />} />
                  <StatCard label="Lediga platser (totalt)" value={totalLeft} textColor={textColor} bg={cardBg}
                    iconElement={<IconBox w='40px' h='40px' bg={boxBg} icon={<Icon as={MdInventory} w='22px' h='22px' color={brandColor} />} />} />
                  <StatCard label="Slutsålda varianter" value={soldOutCount} textColor={textColor} bg={cardBg}
                    iconElement={<IconBox w='40px' h='40px' bg={boxBg} icon={<Icon as={MdWarningAmber} w='22px' h='22px' color={brandColor} />} />} />
                  <StatCard label="Låg nivå (≤5 kvar)" value={lowCount} textColor={textColor} bg={cardBg}
                    iconElement={<IconBox w='40px' h='40px' bg={boxBg} icon={<Icon as={MdWarningAmber} w='22px' h='22px' color={brandColor} />} />} />
                  <StatCard label="Nya anmälningar (denna månad)" value={ordersThisMonthCount} textColor={textColor} bg={cardBg}
                    iconElement={<IconBox w='40px' h='40px' bg={boxBg} icon={<Icon as={MdPaid} w='22px' h='22px' color={brandColor} />} />} />
                  <StatCard label="Fullbokat" value={`${fullPercent}%`} helper={`${current} / ${capacityTotal}`} textColor={textColor} bg={cardBg} accent={fullPercent}
                    iconElement={<IconBox w='40px' h='40px' bg={boxBg} icon={<Icon as={MdInventory} w='22px' h='22px' color={brandColor} />} />} />
                  <GridItem colSpan={{ base: 1, sm: 2, md: 3, xl: 4 }}>
                    <Card borderRadius="2xl" bg={cardBg}>
                      <CardHeader>
                        <Heading size="md" color={textColor}>Mål & progress</Heading>
                      </CardHeader>
                      <CardBody>
                        <Flex direction={{ base: "column", md: "row" }} gap={6} align="stretch">
                          <Box flex="1">
                            <HStack>
                              <Text fontSize="2xl" fontWeight="semibold" color={textColor}>
                                {current} / {goal}
                              </Text>
                              <Badge fontSize="0.8rem">{percent}% uppnått</Badge>
                            </HStack>
                            <Progress value={percent} borderRadius="lg" mt={3} />
                            <Text color="gray.500" fontSize="sm" mt={2}>
                              Detta mål speglas på dashboarden för coacher (utan pengauppgifter).
                            </Text>
                          </Box>
                          <Box w={{ base: "100%", md: "260px" }}>
                            <HStack>
                              <Input
                                type="number"
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                placeholder="Sätt säsongsmål"
                              />
                              <Button onClick={saveGoal} isLoading={saving} minW="120px">
                                Spara mål
                              </Button>
                            </HStack>
                          </Box>
                        </Flex>
                      </CardBody>
                    </Card>
                  </GridItem>
                  {/* Försäljning card: */}
                  <GridItem colSpan={{ base: 1, sm: 2, md: 3, xl: 2 }}>
                    <Card borderRadius="2xl" bg={cardBg}>
                      <CardHeader pb={2}>
                        <Heading size="md" color={textColor}>
                          Försäljning {period === 'month' ? 'denna månad' : 'denna säsong'} – {formatCurrency(sparkData.reduce((s,p)=>s+p.y,0))}
                        </Heading>
                      </CardHeader>
                      <CardBody pt={0} pb={3}>
                        {sparkData.length === 0 ? (
                          <Text color="gray.500">Ingen data ännu.</Text>
                        ) : (
                          <Box as="svg" width="100%" height="140" viewBox="0 0 100 50" cursor="crosshair"
                            onMouseLeave={() => setHoverIdx(null)}
                            onMouseMove={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const xPct = ((e.clientX - rect.left) / rect.width);
                              const idx = Math.round(xPct * (sparkData.length - 1));
                              if (!isNaN(idx)) setHoverIdx(Math.max(0, Math.min(sparkData.length - 1, idx)));
                            }}>
                            {(() => {
                              const pts = sparkData;
                              const ys = pts.map(p => p.y);
                              const maxY = Math.max(1, ...ys);
                              const minY = 0;
                              const x = (i) => (i / Math.max(1, pts.length - 1)) * 100;
                              const y = (val) => 46 - ((val - minY) / (maxY - minY)) * 40; // padding

                              // smooth path (cubic bezier)
                              const d = pts.map((p, i) => {
                                const px = x(i), py = y(p.y);
                                if (i === 0) return `M ${px} ${py}`;
                                const prevX = x(i - 1), prevY = y(pts[i - 1].y);
                                const cx1 = prevX + (px - prevX) * 0.35;
                                const cy1 = prevY;
                                const cx2 = prevX + (px - prevX) * 0.65;
                                const cy2 = py;
                                return `C ${cx1} ${cy1}, ${cx2} ${cy2}, ${px} ${py}`;
                              }).join(' ');

                              // area under curve path
                              const area = `${d} L 100 46 L 0 46 Z`;

                              // gridlines
                              const gridYs = [0, 0.5, 1].map(r => 46 - r * 40);

                              return (
                                <g>
                                  <defs>
                                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
                                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
                                    </linearGradient>
                                    <filter id="glow" x="-10" y="-10" width="120" height="120">
                                      <feGaussianBlur stdDeviation="0.8" result="coloredBlur" />
                                      <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                      </feMerge>
                                    </filter>
                                  </defs>
                                  {gridYs.map((gy, i) => (
                                    <line key={i} x1="0" x2="100" y1={gy} y2={gy} stroke="currentColor" opacity="0.08" strokeWidth="0.5" />
                                  ))}
                                  <path d={area} fill="url(#areaGrad)" />
                                  <path d={d} fill="none" stroke="currentColor" strokeWidth="1.2" filter="url(#glow)" />
                                  {hoverIdx != null && pts[hoverIdx] && (
                                    <g>
                                      <circle cx={x(hoverIdx)} cy={y(pts[hoverIdx].y)} r="1.4" fill="currentColor" />
                                      <rect x={Math.min(76, Math.max(2, x(hoverIdx) - 10))} y={y(pts[hoverIdx].y) - 10} rx="1.2" ry="1.2" width="24" height="8" fill="white" opacity="0.95" />
                                      <text x={Math.min(98, Math.max(4, x(hoverIdx) + 5))} y={y(pts[hoverIdx].y) - 4} fontSize="3" textAnchor="end" fill="black">
                                        {fmtInt(pts[hoverIdx].y)}
                                      </text>
                                    </g>
                                  )}
                                </g>
                              );
                            })()}
                          </Box>
                        )}
                      </CardBody>
                    </Card>
                  </GridItem>
                </SimpleGrid>
              </Stack>
            </TabPanel>

            {/* Intäkter & Budget (admin) */}
            <TabPanel>
              <Stack spacing={6}>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  <FinanceCard
                    label="Intjänat in (DLT)"
                    value={formatCurrency(finance.earned)}
                    icon={MdPaid}
                    cardBg={cardBg}
                    boxBg={boxBg}
                    brandColor={brandColor}
                    textColor={textColor}
                  />
                  <FinanceCard
                    label={`Kvar till budget (${new Intl.NumberFormat('sv-SE').format(finance.budgetAnnual)} kr/år)`}
                    value={<Box as="span" color="red.500">{formatCurrency(finance.budgetLeft ?? Math.max(0, finance.budgetAnnual - finance.earned))}</Box>}
                    icon={MdSavings}
                    cardBg={cardBg}
                    boxBg={boxBg}
                    brandColor={brandColor}
                    textColor={textColor}
                  />
                </SimpleGrid>
              </Stack>
            </TabPanel>

            {/* Kapacitet (WooCommerce) */}
            <TabPanel>
              <Stack spacing={6}>
                <Card borderRadius="2xl" bg={cardBg}>
                  <CardHeader>
                    <Heading size="md" color={textColor}>Lediga platser per variant (WooCommerce)</Heading>
                  </CardHeader>
                  <CardBody>
                    {variants.length === 0 ? (
                      <Text color="gray.500">Ingen variantdata ännu.</Text>
                    ) : (
                      <Box overflowX="auto">
                        <Table size="sm" variant="simple">
                          <Thead>
                            <Tr>
                              <Th>Variant</Th>
                              <Th isNumeric>Platser kvar</Th>
                              <Th>Status</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {variants.map((v) => (
                              <Tr key={v.variationId}>
                                <Td maxW="520px">
                                  <Text noOfLines={1} color={textColor}>{v.label}</Text>
                                </Td>
                                <Td isNumeric>
                                  <Badge colorScheme={v.left === 0 ? "red" : v.left <= 5 ? "orange" : "gray"}>
                                    {v.left}
                                  </Badge>
                                </Td>
                                <Td>
                                  <Badge variant="subtle">{v.status}</Badge>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    )}
                  </CardBody>
                </Card>
              </Stack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Stack>
  );
}