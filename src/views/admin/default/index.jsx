import React, { useState, useEffect } from 'react';
import { Box, SimpleGrid, Text, Card, CardHeader, CardBody, Table, Thead, Tbody, Tr, Th, Td } from "@chakra-ui/react";
import MiniStatistics from "components/card/MiniStatistics";
import TotalSpent from "views/admin/default/components/TotalSpent";
import WeeklyRevenue from "views/admin/default/components/WeeklyRevenue";
import axios from "axios";

const SoldProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSoldProducts = async () => {
      try {
        const url = `${process.env.REACT_APP_WC_URL}/wp-json/wc/v3/products?per_page=100`;
        const response = await axios.get(url, {
          auth: {
            username: process.env.REACT_APP_WC_KEY,
            password: process.env.REACT_APP_WC_SECRET,
          },
        });
        console.log('Products:', response.data);
        const sold = response.data.filter((p) => p.total_sales > 0);
        setProducts(sold);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSoldProducts();
  }, []);

  if (loading) return <Text>Laddar sålda produkter...</Text>;
  if (error) return <Text>Fel: {error}</Text>;
  if (products.length === 0) return <Text>Inga sålda produkter.</Text>;
  return (
    <Card>
      <CardHeader> Sålda Produkter </CardHeader>
      <CardBody>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Total Sales</Th>
              <Th>Price</Th>
            </Tr>
          </Thead>
          <Tbody>
            {products.map((product) => (
              <Tr key={product.id}>
                <Td>{product.name}</Td>
                <Td>{product.total_sales}</Td>
                <Td>{product.price}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </CardBody>
    </Card>
  );
};

const LatestRegistrations = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const wcUrl = process.env.REACT_APP_WC_URL;
        const auth = {
          auth: {
            username: process.env.REACT_APP_WC_KEY,
            password: process.env.REACT_APP_WC_SECRET,
          },
        };
        const ordersResponse = await axios.get(`${wcUrl}/wp-json/wc/v3/orders?per_page=10&orderby=date&order=desc`, auth);
        console.log('Registrations:', ordersResponse.data);
        setOrders(ordersResponse.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) return <Text>Laddar senaste registreringar...</Text>;
  if (error) return <Text>Fel: {error}</Text>;
  if (orders.length === 0) return <Text>Inga registreringar.</Text>;
  return (
    <Card>
      <CardHeader> Senaste Registreringar </CardHeader>
      <CardBody>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Order ID</Th>
              <Th>Datum</Th>
              <Th>Spelare/Namn</Th>
              <Th>Email</Th>
              <Th>Produkt</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {orders.map((order) => (
              <Tr key={order.id}>
                <Td>{order.id}</Td>
                <Td>{new Date(order.date_created).toLocaleDateString('sv-SE')}</Td>
                <Td>{order.billing.first_name} {order.billing.last_name}</Td>
                <Td>{order.billing.email}</Td>
                <Td>{order.line_items.map(item => item.name).join(', ')}</Td>
                <Td>{order.status}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </CardBody>
    </Card>
  );
};

export default function UserReports() {
  const [stats, setStats] = useState({ totalSales: 0, netSales: 0, itemsSold: 0, ordersCount: 0, growth: 0 });
  const [monthlyData, setMonthlyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const wcUrl = process.env.REACT_APP_WC_URL;
        const auth = {
          auth: {
            username: process.env.REACT_APP_WC_KEY,
            password: process.env.REACT_APP_WC_SECRET,
          },
        };
        const ordersResponse = await axios.get(`${wcUrl}/wp-json/wc/v3/orders?per_page=100`, auth);
        console.log('Orders:', ordersResponse.data);
        const orders = ordersResponse.data;
        const totalOrders = orders.length;
        let totalGross = 0;
        let totalNet = 0;
        let totalItems = 0;
        const monthly = {};
        const weekly = {};
        orders.forEach((order) => {
          if (order.status === 'completed') {
            totalGross += parseFloat(order.total);
            totalNet += parseFloat(order.total) - parseFloat(order.total_tax);
            totalItems += order.line_items.reduce((sum, item) => sum + item.quantity, 0);
            const date = new Date(order.date_completed);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            monthly[monthKey] = (monthly[monthKey] || 0) + parseFloat(order.total);
            const weekKey = `${date.getFullYear()}-W${Math.floor(date.getDate() / 7) + 1}`;
            weekly[weekKey] = (weekly[weekKey] || 0) + parseFloat(order.total);
          }
        });
        setStats({
          totalSales: totalGross,
          netSales: totalNet,
          itemsSold: totalItems,
          ordersCount: totalOrders,
          growth: 0, // Beräkna tillväxt om nödvändigt
        });
        setMonthlyData(Object.entries(monthly).map(([date, amount]) => ({ date, amount })));
        setWeeklyData(Object.entries(weekly).map(([date, amount]) => ({ date, amount })));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <Text>Laddar dashboard...</Text>;
  if (error) return <Text>Fel: {error}</Text>;

  return (
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }}>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap="20px" mb="20px">
        <MiniStatistics growth={stats.growth} name="Total Sales" value={stats.totalSales} />
        <MiniStatistics name="Net Sales" value={stats.netSales} />
        <MiniStatistics name="Items Sold" value={stats.itemsSold} />
        <MiniStatistics name="Orders Count" value={stats.ordersCount} />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="20px" mb="20px">
        <TotalSpent data={monthlyData} />
        <WeeklyRevenue data={weeklyData} />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 1 }} gap="20px" mb="20px">
        <SoldProducts />
        <LatestRegistrations />
        {/* <ComplexTable columnsData={columnsDataComplex} tableData={tableDataComplex} /> */}
      </SimpleGrid>
    </Box>
  );
}