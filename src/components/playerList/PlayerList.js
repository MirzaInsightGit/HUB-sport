import React, { useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import axios from 'axios';
import { Card, Heading, Flex, Button, Text, useColorModeValue } from "@chakra-ui/react";
import { CosmosClient } from '@azure/cosmos';

ModuleRegistry.registerModules([AllCommunityModule]);

const StarRatingEditor = (props) => {
  const [value, setValue] = useState(parseInt(props.value) || 0);

  const onStarClick = (newValue) => {
    setValue(newValue);
  };

  const onConfirm = () => {
    props.api.stopEditing();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px' }}>
      <div style={{ display: 'flex' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{ cursor: 'pointer', fontSize: '30px', color: star <= value ? 'gold' : 'gray' }}
            onClick={() => onStarClick(star)}
          >
            ★
          </span>
        ))}
      </div>
      <button onClick={onConfirm} style={{ marginTop: '10px' }}>Bekräfta</button>
    </div>
  );
};

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
          rating: '',
          comments: '',
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

  const getRowStyle = (params) => {
    if (params.data.kon === 'Kvinna/Flicka') {
      return { backgroundColor: '#ffebee' }; // Ljus rosa
    } else if (params.data.kon === 'Man/Pojke') {
      return { backgroundColor: '#f5f5f5' }; // Ljusgrå
    }
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
      field: 'rating', 
      editable: true,
      cellRenderer: (params) => {
        const rating = parseInt(params.value) || 0;
        return '★'.repeat(rating) + '☆'.repeat(5 - rating);
      },
      cellEditor: StarRatingEditor,
      cellEditorPopup: true
    },
    { headerName: 'Kommentarer', field: 'comments', editable: true, cellEditor: 'agLargeTextCellEditor', width: 400 },
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
          paginationPageSize={100}
          onCellValueChanged={onCellValueChanged}
          getRowStyle={getRowStyle}
        />
      </div>
    </Card>
  );
};

export default PlayerList;