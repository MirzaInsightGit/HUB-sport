// Chakra imports
import { Box, SimpleGrid, Text, Spinner } from "@chakra-ui/react";
import DevelopmentTable from "views/admin/statistik/components/DevelopmentTable";
import React, { useEffect, useState } from "react";
import axios from 'axios';
import { CosmosClient } from '@azure/cosmos';

const endpoint = process.env.REACT_APP_COSMOS_ENDPOINT;
const key = process.env.REACT_APP_COSMOS_KEY;
const databaseId = "HUBSportDB";
const containerId = "Players";

const camps = ['Läger 1', 'Läger 2', 'Läger 3', 'Läger 4', 'Läger 5'];
const categories = ['bollkontroll', 'forsvar', 'anfall', 'kommunikation', 'sociala', 'styrka', 'spelforstaelse'];

const campProducts = {
  0: 18801,
  1: 18867,
  2: 18868,
  3: 0,
  4: 0
};

const gradeToNumber = (grade) => {
  const map = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0 };
  return map[grade] || 0;
};

const columnsDataPlayers = [
  { Header: "NAMN", accessor: "name" },
  { Header: "RANK", accessor: "rank" },
  { Header: "SNITT POÄNG", accessor: "average" },
  { Header: "LÄGER 1", accessor: "camp1" },
  { Header: "LÄGER 2", accessor: "camp2" },
  { Header: "LÄGER 3", accessor: "camp3" },
  { Header: "LÄGER 4", accessor: "camp4" },
  { Header: "LÄGER 5", accessor: "camp5" },
];

const processData = (gender, players) => {
  return players
    .filter(player => player.kon === gender)
    .map(player => {
      const ratings = player.ratings || camps.map(() => ({}));
      const overallSum = ratings.reduce((sum, rating) => sum + categories.reduce((s, cat) => s + gradeToNumber(rating[cat] || 'F'), 0), 0);
      const totalCount = ratings.length * categories.length;
      const average = totalCount ? (overallSum / totalCount).toFixed(2) : '0.00';
      const campAverages = ratings.map(rating => {
        const sum = categories.reduce((s, cat) => s + gradeToNumber(rating[cat] || 'F'), 0);
        return (sum / categories.length).toFixed(2);
      });
      return { ...player, average, campAverages };
    })
    .sort((a, b) => b.average - a.average)
    .map((player, index) => ({
      name: player.spelarnamn || player.name,
      rank: index + 1,
      average: player.average,
      camp1: player.campAverages[0],
      camp2: player.campAverages[1],
      camp3: player.campAverages[2],
      camp4: player.campAverages[3],
      camp5: player.campAverages[4],
    }));
};

export default function StatistikDistrikt() {
  const [femaleData, setFemaleData] = useState([]);
  const [maleData, setMaleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPlayers = async () => {
      const baseUrl = process.env.REACT_APP_WC_URL;
      if (!baseUrl) {
        setError('REACT_APP_WC_URL is not defined in .env');
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get(`${baseUrl}/wp-json/wc/v3/orders`, {
          params: { status: 'completed', per_page: 100 },
          auth: {
            username: process.env.REACT_APP_WC_KEY,
            password: process.env.REACT_APP_WC_SECRET
          }
        });
        const playersMap = new Map();
        response.data.forEach(order => {
          const purchasedCamps = [];
          order.line_items.forEach(item => {
            const campIndex = Object.entries(campProducts).find(([key, val]) => val === item.product_id)?.[0];
            if (campIndex !== undefined) {
              purchasedCamps.push(parseInt(campIndex));
            }
          });
          if (purchasedCamps.length > 0) {
            const email = order.billing.email;
            if (email) {
              if (!playersMap.has(email)) {
                const getMeta = (key) => order.meta_data.find(m => m.key === key)?.value || '';
                playersMap.set(email, {
                  id: email,
                  name: `${order.billing.first_name} ${order.billing.last_name}`,
                  email,
                  phone: order.billing.phone || '',
                  address: `${order.billing.address_1}, ${order.billing.city}` || '',
                  spelarnamn: getMeta('dlt_spelarnamn'),
                  kon: getMeta('dlt_kon'),
                  mobilnummer: getMeta('dlt_mobilnummer'),
                  spelarmejl: getMeta('dlt_spelarmejl'),
                  klubblag: getMeta('dlt_klubblag'),
                  basket_position: getMeta('dlt_basket_position'),
                  aktuellserie: getMeta('dlt_aktuellserie'),
                  alderspelare: getMeta('dlt_alderspelare'),
                  registeredCamps: camps.map(() => false)
                });
              }
              purchasedCamps.forEach(campIndex => {
                playersMap.get(email).registeredCamps[campIndex] = true;
              });
            }
          }
        });
        const players = Array.from(playersMap.values());
        const client = new CosmosClient({ endpoint, key });
        const database = client.database(databaseId);
        const container = database.container(containerId);
        for (let player of players) {
          try {
            const { resources } = await container.items.query({
              query: "SELECT * FROM c WHERE c.id = @id",
              parameters: [{ name: "@id", value: player.id }]
            }).fetchAll();
            if (resources.length > 0) {
              const resource = resources[0];
              let ratings = resource.ratings || camps.map(() => ({}));
              if (!Array.isArray(ratings) || ratings.length !== camps.length) {
                ratings = camps.map(() => ({}));
              }
              player.ratings = ratings;
            } else {
              player.ratings = camps.map(() => ({}));
            }
          } catch (err) {
            console.error('Error loading for player', player.id, err);
            player.ratings = camps.map(() => ({}));
          }
        }

        setFemaleData(processData('Kvinna/Flicka', players));
        setMaleData(processData('Man/Pojke', players));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching players:', error);
        setError('Error fetching players: ' + error.message);
        setLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  if (loading) return <Spinner size="xl" speed="0.65s" thickness="4px" color="blue.500" position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" />;
  if (error) return <Text color="red">{error}</Text>;

  return (
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }}>
      <SimpleGrid columns={{ sm: 1, md: 2 }} spacing={{ base: "20px", xl: "20px" }}>
        <DevelopmentTable columnsData={columnsDataPlayers} tableData={femaleData} title="Bästa Rankade Tjejer" />
        <DevelopmentTable columnsData={columnsDataPlayers} tableData={maleData} title="Bästa Rankade Killar" />
      </SimpleGrid>
    </Box>
  );
}