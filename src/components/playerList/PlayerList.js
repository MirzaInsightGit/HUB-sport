import React, { useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import axios from 'axios';
import { Card, Heading, Flex, Button, Text, useColorModeValue } from "@chakra-ui/react";
import { CosmosClient } from '@azure/cosmos';

ModuleRegistry.registerModules([AllCommunityModule]);

const PlayerList = () => {
  const [rowData, setRowData] = useState([]);
  const textColor = useColorModeValue("navy.700", "white");

  const cosmosClient = new CosmosClient({
    endpoint: process.env.REACT_APP_COSMOS_ENDPOINT,
    key: process.env.REACT_APP_COSMOS_KEY
  });
  const database = cosmosClient.database('HUBSportDB');
  const container = database.container('Players');

  const fetchPlayers = useCallback(async () => {
    const baseUrl = process.env.REACT_APP_WC_URL;
    if (!baseUrl) {
      console.error('REACT_APP_WC_URL is not defined in .env');
      return;
    }
    try {
      const response = await axios.get(`${baseUrl}/wp-json/wc/v3/orders`, {
        params: { status: 'any', per_page: 100 },
        auth: {
          username: process.env.REACT_APP_WC_KEY,
          password: process.env.REACT_APP_WC_SECRET
        }
      });
      console.log('Orders fetched:', response.data.length);
      let players = response.data.map(order => ({
        id: order.id.toString(),
        name: `${order.billing.first_name} ${order.billing.last_name}`,
        email: order.billing.email,
        phone: order.billing.phone || '',
        address: `${order.billing.address_1}, ${order.billing.city}` || '',
        rating: '',
        comments: ''
      }));
      for (let player of players) {
        try {
          const { resource } = await container.item(player.id, player.id).read();
          if (resource) {
            player.rating = resource.rating || '';
            player.comments = resource.comments || '';
            console.log('Loaded data for player', player.id, resource);
          }
        } catch (err) {
          console.error('Error loading for player', player.id, err);
        }
      }
      setRowData(players);
    } catch (error) {
      console.error('Error fetching players:', error.response ? error.response.data : error.message);
    }
  }, [container]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const onCellValueChanged = async (params) => {
    const { data } = params;
    try {
      const item = {
        id: data.id,
        rating: data.rating || '',
        comments: data.comments || ''
      };
      await container.items.upsert(item, { partitionKey: data.id });
      console.log('Successfully saved to Cosmos:', data);
    } catch (err) {
      console.error('Error saving to Cosmos:', err);
    }
  };

  const columnDefs = [
    { headerName: 'Namn', field: 'name', sortable: true, filter: true },
    { headerName: 'Email', field: 'email', sortable: true, filter: true },
    { headerName: 'Telefon', field: 'phone', sortable: true, filter: true },
    { headerName: 'Adress', field: 'address', sortable: true, filter: true },
    { headerName: 'Betyg', field: 'rating', editable: true },
    { headerName: 'Kommentarer', field: 'comments', editable: true, cellEditor: 'agLargeTextCellEditor' }
  ];

  return (
    <Card p='20px' borderRadius='20px' boxShadow='lg' mt='20px' bg='white' w='100%'>
      <Flex justify='space-between' align='center' mb='4'>
        <Heading size='lg' color={textColor}>Registrerade Spelare</Heading>
        <Button variant='brand' size='sm'>Lägg till</Button>
      </Flex>
      <Text mb='4' color='secondaryGray.600'>Hantera spelare och betyg</Text>
      <div className="ag-theme-quartz" style={{ height: 650, width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          pagination={true}
          paginationPageSize={100}
          onCellValueChanged={onCellValueChanged}
        />
      </div>
    </Card>
  );
};

export default PlayerList;