// src/views/admin/default/index.jsx

/*!
  _   _  ___  ____  ___ ________  _   _   _   _ ___   
 | | | |/ _ \|  _ \|_ _|__  / _ \| \ | | | | | |_ _| 
 | |_| | | | | |_) || |  / / | | |  \| | | | | || | 
 |  _  | |_| |  _ < | | / /| |_| | |\  | | |_| || |
 |_| |_|\___/|_| \_\___/____\___/|_| \_|  \___/|___|
                                                                                                                                                                                                                                                                                                                                       
=========================================================
* Horizon UI - v1.1.0
=========================================================

* Product Page: https://www.horizon-ui.com/
* Copyright 2023 Horizon UI[](https://www.horizon-ui.com/)

* Designed and Coded by Simmmple

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/

// Chakra imports
import {
  Avatar,
  Box,
  Flex,
  FormLabel,
  Icon,
  Select,
  SimpleGrid,
  useColorModeValue,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Card,
  CardHeader,
  CardBody,
} from "@chakra-ui/react";
// Assets
import Se from "assets/img/dashboards/se.png";
// Custom components
import MiniCalendar from "components/calendar/MiniCalendar";
import MiniStatistics from "components/card/MiniStatistics";
import IconBox from "components/icons/IconBox";
import React, { useState, useEffect } from "react";
import {
  MdAddTask,
  MdAttachMoney,
  MdBarChart,
  MdFileCopy,
} from "react-icons/md";
import ComplexTable from "views/admin/default/components/ComplexTable";
import DailyTraffic from "views/admin/default/components/DailyTraffic";
import PieCard from "views/admin/default/components/PieCard";
import Tasks from "views/admin/default/components/Tasks";
import TotalSpent from "views/admin/default/components/TotalSpent";
import WeeklyRevenue from "views/admin/default/components/WeeklyRevenue";
import {
  columnsDataComplex,
} from "views/admin/default/variables/columnsData";
import tableDataComplex from "views/admin/default/variables/tableDataComplex.json";
import axios from "axios";

const SoldProducts = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchSoldProducts = async () => {
      const url = `${process.env.REACT_APP_WC_URL}/wp-json/wc/v3/products?per_page=100`;
      const response = await axios.get(url, {
        auth: {
          username: process.env.REACT_APP_WC_KEY,
          password: process.env.REACT_APP_WC_SECRET,
        },
      });
      const sold = response.data.filter((p) => p.total_sales > 0);
      setProducts(sold);
    };
    fetchSoldProducts();
  }, []);

  return (
    <Card>
      <CardHeader>
        <Text fontSize="xl" fontWeight="bold" color="black">Sålda Produkter</Text>
      </CardHeader>
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

  useEffect(() => {
    const fetchOrders = async () => {
      const wcUrl = process.env.REACT_APP_WC_URL;
      const auth = {
        auth: {
          username: process.env.REACT_APP_WC_KEY,
          password: process.env.REACT_APP_WC_SECRET,
        },
      };

      // Hämtar de 10 senaste ordrarna från WooCommerce, sorterade efter datum (nyast först).
      // Ingen kategori-filter, så alla ordrar visas.
      const ordersResponse = await axios.get(`${wcUrl}/wp-json/wc/v3/orders?per_page=10&orderby=date&order=desc`, auth);
      setOrders(ordersResponse.data);
    };
    fetchOrders();
  }, []);

  return (
    <Card>
      <CardHeader>
        <Text fontSize="xl" fontWeight="bold" color="black">Senaste Registreringar</Text>
      </CardHeader>
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
  // Chakra Color Mode
  const brandColor = useColorModeValue("brand.500", "white");
  const boxBg = useColorModeValue("secondaryGray.300", "whiteAlpha.100");

  const [stats, setStats] = useState({
    totalSales: 0,
    netSales: 0,
    itemsSold: 0,
    ordersCount: 0,
    growth: 0,
  });

  const [monthlyData, setMonthlyData] = useState([]); // För TotalSpent graf {date, amount}
  const [weeklyData, setWeeklyData] = useState([]); // För WeeklyRevenue {day, amount}

  useEffect(() => {
    const fetchData = async () => {
      const wcUrl = process.env.REACT_APP_WC_URL;
      const auth = {
        auth: {
          username: process.env.REACT_APP_WC_KEY,
          password: process.env.REACT_APP_WC_SECRET,
        },
      };

      const today = new Date();
      const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const lastDayMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();
      const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
      const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).toISOString();

      // Hämta ordrar denna månad
      const ordersThisMonth = await axios.get(`${wcUrl}/wp-json/wc/v3/orders?status=completed&after=${firstDayMonth}&before=${lastDayMonth}&per_page=100`, auth);
      const salesThisMonth = ordersThisMonth.data.reduce((acc, order) => acc + parseFloat(order.total), 0);
      const itemsThisMonth = ordersThisMonth.data.reduce((acc, order) => acc + order.line_items.length, 0);
      const ordersCountThisMonth = ordersThisMonth.data.length;

      // Hämta ordrar förra månaden för growth
      const ordersPrevMonth = await axios.get(`${wcUrl}/wp-json/wc/v3/orders?status=completed&after=${firstDayPrevMonth}&before=${lastDayPrevMonth}&per_page=100`, auth);
      const salesPrevMonth = ordersPrevMonth.data.reduce((acc, order) => acc + parseFloat(order.total), 0);
      const growth = salesPrevMonth > 0 ? ((salesThisMonth - salesPrevMonth) / salesPrevMonth * 100).toFixed(2) : 0;

      setStats({
        totalSales: salesThisMonth.toFixed(2),
        netSales: salesThisMonth.toFixed(2), // Anta net = total för enkelhet
        itemsSold: itemsThisMonth,
        ordersCount: ordersCountThisMonth,
        growth,
      });

      // Månadsdata för graf (daglig)
      const dailySales = {};
      ordersThisMonth.data.forEach(order => {
        const date = order.date_created.split('T')[0];
        dailySales[date] = (dailySales[date] || 0) + parseFloat(order.total);
      });
      const monthly = Object.keys(dailySales).map(date => ({ date, amount: dailySales[date] }));
      setMonthlyData(monthly.sort((a, b) => new Date(a.date) - new Date(b.date)));

      // Veckodata för graf (daglig denna vecka, med 0 för tomma dagar)
      const firstDayWeek = new Date(today);
      firstDayWeek.setDate(today.getDate() - today.getDay() + 1); // Måndag
      const weeklySales = {};
      for (let i = 0; i < 7; i++) {
        const day = new Date(firstDayWeek);
        day.setDate(firstDayWeek.getDate() + i);
        const dayStr = day.getDate();
        weeklySales[dayStr] = 0;
      }
      ordersThisMonth.data.filter(order => new Date(order.date_created) >= firstDayWeek).forEach(order => {
        const day = new Date(order.date_created).getDate();
        weeklySales[day] = (weeklySales[day] || 0) + parseFloat(order.total);
      });
      const weekly = Object.keys(weeklySales).map(day => ({ day: parseInt(day), amount: weeklySales[day] }));
      setWeeklyData(weekly.sort((a, b) => a.day - b.day));
    };
    fetchData();
  }, []);

  return (
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }}>
      <SimpleGrid
        columns={{ base: 1, md: 2, lg: 3, "2xl": 6 }}
        gap='20px'
        mb='20px'>
        <MiniStatistics
          startContent={
            <IconBox
              w='56px'
              h='56px'
              bg={boxBg}
              icon={
                <Icon w='32px' h='32px' as={MdBarChart} color={brandColor} />
              }
            />
          }
          name='Total Försäljning'
          value={`${stats.totalSales} kr`}
        />
        <MiniStatistics
          startContent={
            <IconBox
              w='56px'
              h='56px'
              bg={boxBg}
              icon={
                <Icon w='32px' h='32px' as={MdAttachMoney} color={brandColor} />
              }
            />
          }
          name='Netto Försäljning'
          value={`${stats.netSales} kr`}
        />
        <MiniStatistics 
          growth={`${stats.growth}%`} 
          name='Sålda Artiklar' 
          value={stats.itemsSold} 
        />
        <MiniStatistics
          endContent={
            <Flex me='-16px' mt='10px'>
              <FormLabel htmlFor='balance'>
                <Avatar src={Se} />
              </FormLabel>
              <Select
                id='balance'
                variant='mini'
                mt='5px'
                me='0px'
                defaultValue='sek'>
                <option value='sek'>SEK</option>
              </Select>
            </Flex>
          }
          name='Ditt Saldo'
          value={`${stats.netSales} kr`}
        />
        <MiniStatistics
          startContent={
            <IconBox
              w='56px'
              h='56px'
              bg='linear-gradient(90deg, #4481EB 0%, #04BEFE 100%)'
              icon={<Icon w='28px' h='28px' as={MdAddTask} color='white' />}
            />
          }
          name='Nya Beställningar'
          value={stats.ordersCount}
        />
        <MiniStatistics
          startContent={
            <IconBox
              w='56px'
              h='56px'
              bg={boxBg}
              icon={
                <Icon w='32px' h='32px' as={MdFileCopy} color={brandColor} />
              }
            />
          }
          name='Totala Produkter'
          value='2935' // Statisk eller hämta via API om behövs
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 2 }} gap='20px' mb='20px'>
        <TotalSpent data={monthlyData} total={stats.totalSales} growth={stats.growth} />
        <WeeklyRevenue data={weeklyData} />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 1, xl: 2 }} gap='20px' mb='20px'>
        <SoldProducts />
        <LatestRegistrations />
        <SimpleGrid columns={{ base: 1, md: 2, xl: 2 }} gap='20px'>
          <DailyTraffic />
          <PieCard />
        </SimpleGrid>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 1, xl: 2 }} gap='20px' mb='20px'>
        <ComplexTable
          columnsData={columnsDataComplex}
          tableData={tableDataComplex}
        />
        <SimpleGrid columns={{ base: 1, md: 2, xl: 2 }} gap='20px'>
          <Tasks />
          <MiniCalendar h='100%' minW='100%' selectRange={false} />
        </SimpleGrid>
      </SimpleGrid>
    </Box>
  );
}