import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import axios from 'axios';
import { Card, Heading, Flex, Button, Text, useColorModeValue, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, Box, useDisclosure } from "@chakra-ui/react";
import { CosmosClient } from '@azure/cosmos';
import { useMsal } from "@azure/msal-react";

ModuleRegistry.registerModules([AllCommunityModule]);

const camps = ['Läger 1', 'Läger 2', 'Läger 3', 'Läger 4', 'Läger 5'];
const categories = ['bollkontroll', 'forsvar', 'anfall', 'kommunikation', 'sociala', 'styrka', 'spelforstaelse'];
const categoryTitles = ['Bollkontroll', 'Försvar', 'Anfall', 'Kommunikation', 'Sociala egenskaper', 'Styrka/Kondition', 'Spelförståelse'];

const campProducts = {
  0: 18801, // Läger 1
  1: 18867, // Läger 2
  2: 18868, // Läger 3
  3: 0,     // Läger 4 - placeholder
  4: 0      // Läger 5 - placeholder
};

const PlayerList = () => {
  const [rowData, setRowData] = useState([]);
  const textColor = useColorModeValue("navy.700", "white");
  const { accounts } = useMsal();
  const currentUser = accounts[0] ? accounts[0].name : 'Unknown';
  const { isOpen, onOpen, onClose } = useDisclosure();
  const gridRef = useRef();

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
              if (Array.isArray(resource.rating)) {
                ratings[0] = resource.rating[resource.rating.length - 1] || {};
              } else if (resource.rating && typeof resource.rating === 'object') {
                ratings[0] = resource.rating;
              }
            }
            let comments = resource.comments || camps.map(() => ({ value: '', by: '', timestamp: '' }));
            if (!Array.isArray(comments) || comments.length !== camps.length) {
              comments = camps.map(() => ({ value: '', by: '', timestamp: '' }));
              if (typeof resource.comments === 'string') {
                comments[0] = { value: resource.comments, by: '', timestamp: '' };
              } else if (resource.comments && typeof resource.comments === 'object') {
                comments[0] = { value: resource.comments.value || '', by: resource.comments.by || '', timestamp: resource.comments.timestamp || '' };
              }
            }
            player.ratings = ratings;
            player.comments = comments;
            console.log('Loaded data for player', player.id, resource);
          } else {
            const item = {
              id: player.id,
              ratings: camps.map(() => ({})),
              comments: camps.map(() => ({ value: '', by: '', timestamp: '' }))
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

  const savePlayerData = async (playerId, data) => {
    try {
      const { resource } = await container.items.upsert(data, { partitionKey: playerId });
      console.log('Saved to Cosmos:', resource);
    } catch (err) {
      console.error('Error saving to Cosmos:', err.message, err.code);
    }
  };

  const onCellValueChanged = async (params) => {
    console.log('Cell value changed', params.colDef.headerName, 'old:', params.oldValue, 'new:', params.newValue);
    const campIndex = params.colDef.campIndex;
    const cat = params.colDef.cat;
    let needSave = false;
    if (cat) {
      if (params.oldValue !== params.newValue) {
        params.data.ratings[campIndex][cat] = params.newValue;
        params.data.ratings[campIndex].by = currentUser;
        params.data.ratings[campIndex].timestamp = new Date().toISOString();
        needSave = true;
        params.api.refreshCells({ columns: [`average_${campIndex}`], rowNodes: [params.node], force: true });
      }
    } else if (params.colDef.headerName === 'Kommentarer') {
      if (params.oldValue !== params.newValue) {
        params.data.comments[campIndex].value = params.newValue;
        params.data.comments[campIndex].by = currentUser;
        params.data.comments[campIndex].timestamp = new Date().toISOString();
        needSave = true;
      }
    }
    if (needSave) {
      const item = {
        id: params.data.id,
        ratings: params.data.ratings,
        comments: params.data.comments
      };
      await savePlayerData(params.data.id, item);
    }
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

  const calculateAverage = (rating) => {
    const values = categories.map(key => gradeToNumber(rating[key]));
    const averageNum = (values.reduce((a, b) => a + b, 0) / categories.length);
    return ['A', 'B', 'C', 'D', 'E', 'F'][5 - Math.round(averageNum)];
  };

  const ratingAverageRenderer = (params, campIndex) => {
    const rating = params.data.ratings[campIndex] || {};
    const averageGrade = calculateAverage(rating);
    const by = rating.by ? ` by ${rating.by}` : '';
    const ts = rating.timestamp ? ` at ${new Date(rating.timestamp).toLocaleString()}` : '';
    return averageGrade + ' (genomsnitt)' + by + ts;
  };

  const commentsRenderer = (params, campIndex) => {
    const comment = params.data.comments[campIndex] || { value: '', by: '', timestamp: '' };
    const value = comment.value || '';
    const by = comment.by ? ` by ${comment.by}` : '';
    const ts = comment.timestamp ? ` at ${new Date(comment.timestamp).toLocaleString()}` : '';
    return value + by + ts;
  };

  const onGridReady = (params) => {
    gridRef.current.api = params.api;
    setTimeout(() => addDots(params.api), 500);
  };

  const addDots = (api) => {
    const scrollViewport = document.querySelector('.ag-body-horizontal-scroll-viewport');
    if (!scrollViewport) return;
    const scrollWidth = scrollViewport.scrollWidth;
    const clientWidth = scrollViewport.clientWidth;
    const dotContainer = document.createElement('div');
    dotContainer.style.position = 'absolute';
    dotContainer.style.bottom = '0';
    dotContainer.style.left = '0';
    dotContainer.style.width = '100%';
    dotContainer.style.height = '30px';
    dotContainer.style.pointerEvents = 'none';
    dotContainer.style.background = 'linear-gradient(to right, #ff0000, #ff0000)'; // Red line like YouTube
    dotContainer.style.height = '2px';
    const progressBar = document.createElement('div');
    progressBar.style.position = 'absolute';
    progressBar.style.left = '0';
    progressBar.style.bottom = '0';
    progressBar.style.height = '2px';
    progressBar.style.backgroundColor = '#ff0000';
    progressBar.style.width = '0%';
    dotContainer.appendChild(progressBar);
    scrollViewport.addEventListener('scroll', () => {
      const scrollLeft = scrollViewport.scrollLeft;
      const progress = (scrollLeft / (scrollWidth - clientWidth)) * 100;
      progressBar.style.width = `${progress}%`;
    });
    camps.forEach((camp, index) => {
      const columnGroup = api.getColumnGroup(camp);
      if (columnGroup) {
        const left = columnGroup.getLeft();
        const position = (left / (scrollWidth - clientWidth)) * 100;
        const dot = document.createElement('div');
        dot.style.position = 'absolute';
        dot.style.left = `${position}%`;
        dot.style.bottom = '10px';
        dot.style.width = '12px';
        dot.style.height = '12px';
        dot.style.backgroundColor = '#ff0000';
        dot.style.borderRadius = '50%';
        dot.style.cursor = 'pointer';
        dot.style.pointerEvents = 'auto';
        dot.title = camp;
        dot.onclick = () => api.ensureColumnVisible(columnGroup.getColGroupDef().children[0].colId, 'start');
        dotContainer.appendChild(dot);
      }
    });
    scrollViewport.appendChild(dotContainer);
  };

  const columnDefs = useMemo(() => [
    { headerName: 'Spelarnamn', field: 'spelarnamn', sortable: true, filter: true, pinned: 'left' },
    { headerName: 'Kön', field: 'kon', sortable: true, filter: true },
    { headerName: 'Ålderspelare', field: 'alderspelare', sortable: true, filter: true },
    { headerName: 'Klubblag', field: 'klubblag', sortable: true, filter: true },
    { headerName: 'Basket Position', field: 'basket_position', sortable: true, filter: true },
    { headerName: 'Aktuell Serie', field: 'aktuellserie', sortable: true, filter: true },
    { headerName: 'Mobilnummer', field: 'mobilnummer', sortable: true, filter: true },
    { headerName: 'Spelarmejl', field: 'spelarmejl', sortable: true, filter: true },
    { headerName: 'Föräldrar namn', field: 'name', sortable: true, filter: true },
    { headerName: 'Föräldrar Email', field: 'email', sortable: true, filter: true },
    { headerName: 'Föräldrar Telefon', field: 'phone', sortable: true, filter: true },
    { headerName: 'Föräldrar Adress', field: 'address', sortable: true, filter: true },
    ...camps.flatMap((camp, campIndex) => [
      {
        headerName: `${camp} Anmäld`,
        valueGetter: (params) => params.data.registeredCamps[campIndex] ? 'Ja' : 'Nej',
        width: 120
      },
      {
        headerName: camp,
        headerClass: `camp-header-${campIndex}`,
        children: [
          ...categories.map((cat, catIndex) => ({
            headerName: categoryTitles[catIndex],
            editable: (params) => params.data.registeredCamps[campIndex],
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: ['A', 'B', 'C', 'D', 'E', 'F'] },
            valueGetter: (params) => params.data.ratings[campIndex][cat] || 'F',
            valueSetter: (params) => {
              params.data.ratings[campIndex][cat] = params.newValue;
              return true;
            },
            onCellValueChanged,
            campIndex,
            cat
          })),
          {
            headerName: 'Genomsnitt',
            cellRenderer: (params) => ratingAverageRenderer(params, campIndex),
            valueGetter: (params) => calculateAverage(params.data.ratings[campIndex] || {}),
            colId: `average_${campIndex}`
          },
          {
            headerName: 'Kommentarer',
            editable: (params) => params.data.registeredCamps[campIndex],
            cellEditor: 'agLargeTextCellEditor',
            cellRenderer: (params) => commentsRenderer(params, campIndex),
            width: 300,
            valueGetter: (params) => params.data.comments[campIndex]?.value || '',
            valueSetter: (params) => {
              if (!params.data.comments[campIndex]) {
                params.data.comments[campIndex] = { value: '', by: '', timestamp: '' };
              }
              params.data.comments[campIndex].value = params.newValue;
              return true;
            },
            onCellValueChanged
          }
        ]
      }
    ])
  ], []);

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
          <Button variant='brand' size='sm'>Ni kan endast fylla i läger betyg. </Button>
          <Button style={{ backgroundColor: 'lightgreen' }} size='sm' ml='2' onClick={onOpen}>Betyg Info - Läs mer</Button>
        </Flex>
      </Flex>
      <Text mb='4' color='secondaryGray.600'>Du ser endast godkända och registrerade spelare, scrolla för att hitta till olika läger.</Text>
      <style>
        {`
          .camp-header-0 { background-color: #f0f8ff; } /* AliceBlue for Läger 1 */
          .camp-header-1 { background-color: #f5f5dc; } /* Beige for Läger 2 */
          .camp-header-2 { background-color: #fffacd; } /* LemonChiffon for Läger 3 */
          .camp-header-3 { background-color: #fafad2; } /* LightGoldenrodYellow for Läger 4 */
          .camp-header-4 { background-color: #f0fff0; } /* Honeydew for Läger 5 */
          .ag-body-horizontal-scroll { height: 30px !important; }
          .ag-body-horizontal-scroll-viewport { background-color: #ccc; }
          .ag-body-horizontal-scroll-container { background-color: #ccc; }
          .ag-horizontal-left-spacer, .ag-horizontal-right-spacer { background-color: #ccc; }
          .ag-body-horizontal-scroll-thumb { background-color: #555; height: 30px; border-radius: 5px; }
        `}
      </style>
      <div className="ag-theme-quartz" style={{ height: 650, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          pagination={true}
          paginationPageSize={50}
          getRowStyle={getRowStyle}
          stopEditingWhenCellsLoseFocus={true}
          onGridReady={onGridReady}
        />
      </div>
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Betyg Förklaringar</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb="4">Ange betyg för varje läger och kategori A-F, där A är högsta betyget. Allt sparas automatiskt i Databsen hos Stockholm Basket.</Text>
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