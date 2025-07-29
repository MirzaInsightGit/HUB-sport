// views/admin/default/components/WeeklyRevenue.jsx

import {
  Box,
  Button,
  Flex,
  Icon,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import Card from "components/card/Card.js";
// Custom components
import BarChart from "components/charts/BarChart";
import React from "react";
import { MdBarChart } from "react-icons/md";

export default function WeeklyRevenue({ data = [] }) {
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const iconColor = useColorModeValue("brand.500", "white");
  const bgButton = useColorModeValue("secondaryGray.300", "whiteAlpha.100");
  const bgHover = useColorModeValue(
    { bg: "secondaryGray.400" },
    { bg: "whiteAlpha.50" }
  );
  const bgFocus = useColorModeValue(
    { bg: "secondaryGray.300" },
    { bg: "whiteAlpha.100" }
  );

  const chartData = [
    {
      name: "Försäljning",
      data: data.map(d => d.amount),
    },
  ];

  const chartOptions = {
    chart: {
      toolbar: { show: false },
    },
    tooltip: { theme: "dark" },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth" },
    xaxis: {
      type: "numeric",
      categories: data.map(d => d.day),
      labels: { style: { colors: "#A3AED0", fontSize: "12px" } },
    },
    yaxis: {
      labels: { style: { colors: "#A3AED0", fontSize: "12px" } },
    },
    legend: { show: false },
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        type: "vertical",
        shadeIntensity: 0.5,
        gradientToColors: undefined,
        inverseColors: true,
        opacityFrom: 0.8,
        opacityTo: 0,
        stops: [],
      },
      colors: ["#4318FF", "#6AD2FF"],
    },
    colors: ["#4318FF", "#6AD2FF"],
    grid: { strokeDashArray: 5 },
  };

  return (
    <Card align='center' direction='column' w='100%'>
      <Flex align='center' w='100%' px='15px' py='10px'>
        <Text
          me='auto'
          color={textColor}
          fontSize='xl'
          fontWeight='700'
          lineHeight='100%'>
          Veckoförsäljning
        </Text>
        <Button
          align='center'
          justifyContent='center'
          bg={bgButton}
          _hover={bgHover}
          _focus={bgFocus}
          _active={bgFocus}
          w='37px'
          h='37px'
          lineHeight='100%'
          borderRadius='10px'>
          <Icon as={MdBarChart} color={iconColor} w='24px' h='24px' />
        </Button>
      </Flex>

      <Box h='240px' mt='auto'>
        <BarChart
          chartData={chartData}
          chartOptions={chartOptions}
        />
      </Box>
    </Card>
  );
}