import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import axios from 'axios';
import { Card, Heading, Flex, Button, Text, useColorModeValue } from "@chakra-ui/react";
import { CosmosClient } from '@azure/cosmos';
import { useMsal } from "@azure/msal-react";

ModuleRegistry.registerModules([AllCommunityModule]);

const PlayerList = () => {
  const [rowData, setRowData] = useState([]);
  const textColor = useColorModeValue("navy.700", "white");
  const { accounts } = useMsal();
  const currentUser = accounts[0] ? accounts[0].name : 'Unknown';

  const container = useMemo(() => {
    const cosmosClient = new CosmosClient({
      endpoint: process.env.REACT_APP_COSMOS_ENDPOINT,
      key: process.env.REACT_APP_COSMOS_KEY
    });
    const database = cosmosClient.database('HUBSportDB');
    return database.container('Players');
  }, []);

  const fetchPlayers = useCallback(async () => {
    const baseUrl = process.env.REACT_APP_WC_URL;
    if (!baseUrl) {
      console.error('REACT_APP_WC_URL is not defined in .env');
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
      console.log('Orders fetched:', response.data.length);
      const filteredOrders = response.data.filter(order => 
        order.line_items.some(item => item.product_id === 18801)
      );
      let players = filteredOrders.map(order => {
        const getMeta = (key) => order.meta_data.find(m => m.key === key)?.value || '';
        console.log('Order meta for', order.id, order.meta_data);
        return {
          id: order.id.toString(),
          name: `${order.billing.first_name} ${order.billing.last_name}`,
          email: order.billing.email,
          phone: order.billing.phone || '',
          address: `${order.billing.address_1}, ${order.billing.city}` || '',
          rating: { value: '', by: '', timestamp: '' },
          comments: { value: '', by: '', timestamp: '' },
          spelarnamn: getMeta('dlt_spelarnamn'),
          kon: getMeta('dlt_kon'),
          mobilenummer: getMeta('dlt_mobilenummer'),
          spelarmejl: getMeta('dlt_spelarmejl'),
          klubblag: getMeta('dlt_klubblag'),
          basket_position: getMeta('dlt_basket_position'),
          aktuellserie: getMeta('dlt_aktuellserie'),
          alderspelare: getMeta('dlt_alderspelare')
        };
      });
      for (let player of players) {
        try {
          const querySpec = {
            query: "SELECT * FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: player.id }]
          };
          const { resources } = await container.items.query(querySpec).fetchAll();
          if (resources.length > 0) {
            const resource = resources[0];
            let rating = resource.rating || { value: '', by: '', timestamp: '' };
            if (typeof rating === 'string') {
              rating = { value: rating, by: '', timestamp: '' };
            }
            player.rating = rating;
            let comments = resource.comments || { value: '', by: '', timestamp: '' };
            if (typeof comments === 'string') {
              comments = { value: comments, by: '', timestamp: '' };
            }
            player.comments = comments;
            console.log('Loaded data for player', player.id, resource);
          } else {
            const item = {
              id: player.id,
              rating: { value: '', by: '', timestamp: '' },
              comments: { value: '', by: '', timestamp: '' }
            };
            await container.items.upsert(item, { partitionKey: player.id });
            console.log('Created new entry for player', player.id);
          }
        } catch (err) {
          console.error('Error loading/creating for player', player.id, err);
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
    console.log('Cell value changed for field', params.colDef.headerName, 'old:', params.oldValue, 'new:', params.newValue);
    const { data } = params;
    if (params.colDef.headerName === 'Betyg') {
      data.rating.by = currentUser;
      data.rating.timestamp = new Date().toISOString();
    } else if (params.colDef.headerName === 'Kommentarer') {
      data.comments.by = currentUser;
      data.comments.timestamp = new Date().toISOString();
    }
    try {
      const item = {
        id: data.id,
        rating: data.rating,
        comments: data.comments
      };
      await container.items.upsert(item, { partitionKey: data.id });
      console.log('Successfully saved to Cosmos:', data);
      params.api.refreshCells({ rowNodes: [params.node], force: true });
    } catch (err) {
      console.error('Error saving to Cosmos:', err);
    }
  };

  const getRowStyle = (params) => {
    if (params.data.kon === 'Kvinna/Flicka') {
      return { backgroundColor: '#ffebee' }; // Ljus rosa
    } else if (params.data.kon === 'Man/Pojke') {
      return { backgroundColor: '#f5f5f5' }; // Ljusgrå
    }
  };

  const ratingRenderer = (params) => {
    const rating = parseInt(params.value) || 0;
    const by = params.data.rating.by ? ` by ${params.data.rating.by}` : '';
    const ts = params.data.rating.timestamp ? ` at ${new Date(params.data.rating.timestamp).toLocaleString()}` : '';
    return '★'.repeat(rating) + '☆'.repeat(5 - rating) + by + ts;
  };

  const commentsRenderer = (params) => {
    const value = params.value || '';
    const by = params.data.comments.by ? ` by ${params.data.comments.by}` : '';
    const ts = params.data.comments.timestamp ? ` at ${new Date(params.data.comments.timestamp).toLocaleString()}` : '';
    return value + by + ts;
  };

  const columnDefs = [
    { headerName: 'Spelarnamn', field: 'spelarnamn', sortable: true, filter: true },
    { headerName: 'Kön', field: 'kon', sortable: true, filter: true },
    { headerName: 'Ålderspelare', field: 'alderspelare', sortable: true, filter: true },
    { headerName: 'Klubblag', field: 'klubblag', sortable: true, filter: true },
    { headerName: 'Basket Position', field: 'basket_position', sortable: true, filter: true },
    { headerName: 'Aktuell Serie', field: 'aktuellserie', sortable: true, filter: true },
    { 
      headerName: 'Betyg', 
      editable: true,
      cellRenderer: ratingRenderer,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['', '1', '2', '3', '4', '5']
      },
      valueGetter: (params) => params.data.rating.value,
      valueSetter: (params) => {
        params.data.rating.value = params.newValue;
        return true;
      }
    },
    { 
      headerName: 'Kommentarer', 
      editable: true, 
      cellEditor: 'agLargeTextCellEditor', 
      cellRenderer: commentsRenderer,
      width: 400,
      valueGetter: (params) => params.data.comments.value,
      valueSetter: (params) => {
        params.data.comments.value = params.newValue;
        return true;
      }
    },
    { headerName: 'Mobilenummer', field: 'mobilenummer', sortable: true, filter: true },
    { headerName: 'Spelarmejl', field: 'spelarmejl', sortable: true, filter: true },
    { headerName: 'Föräldrar namn', field: 'name', sortable: true, filter: true },
    { headerName: 'Föräldrar Email', field: 'email', sortable: true, filter: true },
    { headerName: 'Föräldrar Telefon', field: 'phone', sortable: true, filter: true },
    { headerName: 'Föräldrar Adress', field: 'address', sortable: true, filter: true },
  ];

  return (
    <Card p='20px' borderRadius='20px' boxShadow='lg' mt='20px' bg='white' w='100%'>
      <Flex justify='space-between' align='center' mb='4'>
        <Heading size='lg' color={textColor}>Registrerade Spelare till DLT</Heading>
        <Button variant='brand' size='sm'>Fyll i, allt sparas automatiskt</Button>
      </Flex>
      <Text mb='4' color='secondaryGray.600'>Hantera spelare och betyg</Text>
      <div className="ag-theme-quartz" style={{ height: 650, width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          pagination={true}
          paginationPageSize={50}
          onCellValueChanged={onCellValueChanged}
          getRowStyle={getRowStyle}
        />
      </div>
    </Card>
  );
};

export default PlayerList;