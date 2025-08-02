import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import axios from 'axios';
import { Card, Heading, Flex, Button, Text, useColorModeValue, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, Box, useDisclosure } from "@chakra-ui/react";
import { CosmosClient } from '@azure/cosmos';
import { useMsal } from "@azure/msal-react";

ModuleRegistry.registerModules([AllCommunityModule]);

class DetailedRatingEditor extends React.Component {
  constructor(props) {
    super(props);
    const lastRating = props.value || {};
    this.state = {
      bollkontroll: lastRating.bollkontroll || 'F',
      forsvar: lastRating.forsvar || 'F',
      anfall: lastRating.anfall || 'F',
      kommunikation: lastRating.kommunikation || 'F',
      sociala: lastRating.sociala || 'F',
      styrka: lastRating.styrka || 'F',
      spelforstaelse: lastRating.spelforstaelse || 'F'
    };
  }

  getValue() {
    return this.state;
  }

  isPopup() {
    return true;
  }

  onChange = (category, newValue) => {
    this.setState({ [category]: newValue });
  }

  renderCategory = (category, title) => {
    const value = this.state[category];
    return (
      <div style={{ marginBottom: '15px', width: '100%' }}>
        <h4 style={{ marginBottom: '5px' }}>{title}</h4>
        <select value={value} onChange={(e) => this.onChange(category, e.target.value)} style={{ width: '100%', padding: '5px' }}>
          {['A', 'B', 'C', 'D', 'E', 'F'].map((grade) => (
            <option key={grade} value={grade}>{grade}</option>
          ))}
        </select>
      </div>
    );
  }

  render() {
    return (
      <div style={{ padding: '20px', backgroundColor: 'white', border: '1px solid gray', borderRadius: '5px', maxHeight: '400px', overflowY: 'auto', minWidth: '300px' }}>
        {this.renderCategory('bollkontroll', 'Bollkontroll')}
        {this.renderCategory('forsvar', 'Försvar')}
        {this.renderCategory('anfall', 'Anfall')}
        {this.renderCategory('kommunikation', 'Kommunikation')}
        {this.renderCategory('sociala', 'Sociala egenskaper')}
        {this.renderCategory('styrka', 'Styrka/Kondition')}
        {this.renderCategory('spelforstaelse', 'Spelförståelse')}
        <button onClick={this.props.stopEditing} style={{ marginTop: '15px', padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Bekräfta</button>
      </div>
    );
  }
}

const PlayerList = () => {
  const [rowData, setRowData] = useState([]);
  const textColor = useColorModeValue("navy.700", "white");
  const { accounts } = useMsal();
  const currentUser = accounts[0] ? accounts[0].name : 'Unknown';
  const { isOpen, onOpen, onClose } = useDisclosure();

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
          rating: [],
          comments: { value: '', by: '', timestamp: '' },
          spelarnamn: getMeta('dlt_spelarnamn'),
          kon: getMeta('dlt_kon'),
          mobilnummer: getMeta('dlt_mobilnummer'),
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
            player.rating = resource.rating || [];
            let comments = resource.comments || { value: '', by: '', timestamp: '' };
            if (typeof comments === 'string') {
              comments = { value: comments, by: '', timestamp: '' };
            }
            player.comments = comments;
            console.log('Loaded data for player', player.id, resource);
          } else {
            const item = {
              id: player.id,
              rating: [],
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
    console.log('Cell value changed', params.colDef.headerName, 'old:', params.oldValue, 'new:', params.newValue);
    let needSave = false;
    if (params.colDef.headerName === 'Betyg') {
      const oldRating = params.oldValue || {};
      const newRating = params.newValue || {};
      const categories = ['bollkontroll', 'forsvar', 'anfall', 'kommunikation', 'sociala', 'styrka', 'spelforstaelse'];
      const oldVals = categories.reduce((acc, key) => { acc[key] = oldRating[key] || 'F'; return acc; }, {});
      const newVals = categories.reduce((acc, key) => { acc[key] = newRating[key] || 'F'; return acc; }, {});
      if (JSON.stringify(oldVals) !== JSON.stringify(newVals)) {
        params.data.rating.push({ ...newRating, by: currentUser, timestamp: new Date().toISOString() });
        needSave = true;
      }
    } else if (params.colDef.headerName === 'Kommentarer') {
      if (params.oldValue !== params.newValue) {
        params.data.comments.by = currentUser;
        params.data.comments.timestamp = new Date().toISOString();
        needSave = true;
      }
    }
    if (needSave) {
      try {
        const item = {
          id: params.data.id,
          rating: params.data.rating,
          comments: params.data.comments
        };
        console.log('About to upsert:', item);
        await container.items.upsert(item, { partitionKey: params.data.id });
        console.log('Successfully saved to Cosmos:', params.data);
      } catch (err) {
        console.error('Error saving to Cosmos:', err);
      }
    }
    params.api.refreshCells({ rowNodes: [params.node], force: true });
  };

  const getRowStyle = (params) => {
    if (params.data.kon === 'Kvinna/Flicka') {
      return { backgroundColor: '#ffebee' };
    } else if (params.data.kon === 'Man/Pojke') {
      return { backgroundColor: '#f5f5f5' };
    }
  };

  const gradeToNumber = (grade) => {
    const map = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0 };
    return map[grade] || 0;
  };

  const ratingRenderer = (params) => {
    if (!params.data.rating || params.data.rating.length === 0) return 'F (genomsnitt)';
    const last = params.data.rating[params.data.rating.length - 1];
    const values = ['bollkontroll', 'forsvar', 'anfall', 'kommunikation', 'sociala', 'styrka', 'spelforstaelse'].map(key => gradeToNumber(last[key]));
    const averageNum = (values.reduce((a, b) => a + b, 0) / 7);
    const averageGrade = ['A', 'B', 'C', 'D', 'E', 'F'][5 - Math.round(averageNum)];
    const by = last.by ? ` by ${last.by}` : '';
    const ts = last.timestamp ? ` at ${new Date(last.timestamp).toLocaleString()}` : '';
    return averageGrade + ' (genomsnitt)' + by + ts;
  };

  const commentsRenderer = (params) => {
    const value = params.data.comments.value || '';
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
      cellEditor: DetailedRatingEditor,
      cellEditorPopup: true,
      valueGetter: (params) => params.data.rating.length > 0 ? params.data.rating[params.data.rating.length - 1] : {},
      valueSetter: (params) => true
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
    { headerName: 'Mobilnummer', field: 'mobilnummer', sortable: true, filter: true },
    { headerName: 'Spelarmejl', field: 'spelarmejl', sortable: true, filter: true },
    { headerName: 'Föräldrar namn', field: 'name', sortable: true, filter: true },
    { headerName: 'Föräldrar Email', field: 'email', sortable: true, filter: true },
    { headerName: 'Föräldrar Telefon', field: 'phone', sortable: true, filter: true },
    { headerName: 'Föräldrar Adress', field: 'address', sortable: true, filter: true },
  ];

  const renderCategoryInfo = (title, description) => (
    <Box key={title} mb="4">
      <Heading size="md">{title}</Heading>
      <Text>{description}</Text>
    </Box>
  );

  return (
    <Card p='20px' borderRadius='20px' boxShadow='lg' mt='20px' bg='white' w='100%'>
      <Flex justify='space-between' align='center' mb='4'>
        <Heading size='lg' color={textColor}>Registrerade Spelare till DLT</Heading>
        <Flex>
          <Button variant='brand' size='sm'>Fyll i, allt sparas automatiskt</Button>
          <Button style={{ backgroundColor: 'lightgreen' }} size='sm' ml='2' onClick={onOpen}>Betyg Info</Button>
        </Flex>
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
          stopEditingWhenCellsLoseFocus={true}
        />
      </div>
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Betyg Förklaringar</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {renderCategoryInfo('Bollkontroll', 'Spelarens teknik med boll, förmåga att hantera press, dribbla med båda händer, samt kontroll under matchtempo. Bedömning grundas på bollsäkerhet, rytm och kreativitet i spelet.')}
            {renderCategoryInfo('Försvar', 'Individens förmåga att hålla sin spelare, förstå rotationsprinciper, sätta press, hjälpa laget och visa fysisk samt mental närvaro i försvarsspelet.')}
            {renderCategoryInfo('Anfall', 'Hur spelaren rör sig utan boll, beslutsfattande i 1v1, avslutsförmåga, spelförståelse i passningar och tempo, samt helhet i anfallsspelet.')}
            {renderCategoryInfo('Kommunikation', 'I vilken grad spelaren styr, pratar, tar ansvar för sina medspelare och kommunicerar aktivt i både försvar och anfall – verbalt och icke-verbalt.')}
            {renderCategoryInfo('Sociala egenskaper', 'Ledarskap, energi, coachbarhet, hur spelaren bidrar till lagets kemi, ansvarstagande utanför planen och förmåga att samarbeta i grupp.')}
            {renderCategoryInfo('Styrka/Kondition', 'Fysisk kapacitet att hantera matchtempo, återhämta sig, orka hela vägen i försvar/anfall, samt styrka i närkamper och fysisk motståndskraft.')}
            {renderCategoryInfo('Spelförståelse', 'Speluppfattning, läsa spelet innan det händer, förstå lagets system, ta rätt beslut i olika moment och se helheten i spelet.')}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Card>
  );
};

export default PlayerList;