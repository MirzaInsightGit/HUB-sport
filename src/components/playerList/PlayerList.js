import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import axios from 'axios';
import { Card, Heading, Flex, Button, Text, useColorModeValue, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, Box, useDisclosure } from "@chakra-ui/react";
import { useMsal } from "@azure/msal-react";
import { API_BASE } from '../../config/apiBase';

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
  const { instance, accounts } = useMsal();
  const currentUser = accounts[0] ? accounts[0].name : 'Unknown';
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [favorites, setFavorites] = useState(new Set());
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const gridRef = useRef();


  // ---- Load players + favorites -------------------------------------------------
  const fetchPlayers = useCallback(async () => {
    try {
      // Backend ger redan ihopslagna spelare (Woo + Cosmos ratings)
      const { data } = await axios.get(`${API_BASE}/district/players`);
      const players = data?.players || [];

      // Hämta coachens favoriter
      let favSet = new Set();
      try {
        const apiScopeStr = process.env.REACT_APP_API_SCOPE || '';
        const scopes = apiScopeStr
          ? apiScopeStr.split(',').map((s) => s.trim()).filter(Boolean)
          : [`api://${process.env.REACT_APP_API_CLIENT_ID}/.default`];

        let headers = {};
        try {
          const tokenResp = await instance.acquireTokenSilent({ scopes, account: accounts[0] });
          if (tokenResp?.accessToken) headers.Authorization = `Bearer ${tokenResp.accessToken}`;
        } catch (_) { /* dev utan token */ }
        headers['x-dev-coachid'] = accounts?.[0]?.username || accounts?.[0]?.localAccountId || 'local-dev';

        const res = await fetch(`${API_BASE}/favorites`, { headers });
        const favIds = await res.json();
        favSet = new Set(Array.isArray(favIds) ? favIds : []);
        setFavorites(favSet);
      } catch (e) {
        console.error('Error loading favorites:', e);
      }

      // Normalisera rader så index-åtkomst aldrig spricker
      const normalize = (p) => {
        const regs = Array.isArray(p.registeredCamps) && p.registeredCamps.length === 5 ? p.registeredCamps : [false,false,false,false,false];
        const ratings = Array.isArray(p.ratings) && p.ratings.length === 5 ? p.ratings : [{},{},{},{},{}];
        const comments = Array.isArray(p.comments) && p.comments.length === 5
          ? p.comments
          : [ {}, {}, {}, {}, {} ].map(() => ({ value:'', by:'', timestamp:'' }));
        const campAverages = Array.isArray(p.campAverages) && p.campAverages.length === 5 ? p.campAverages : [0,0,0,0,0];
        return {
          ...p,
          registeredCamps: regs,
          ratings,
          comments,
          campAverages,
          spelarmejl: p.spelarmejl || '',
          mobilnummer: p.mobilnummer || ''
        };
      };
      const playersWithFav = (players || []).map((p) => ({ ...normalize(p), isFavorite: favSet.has(p.id) }));
      setRowData(playersWithFav);
    } catch (error) {
      console.error('Error fetching players:', error.response ? error.response.data : error.message);
    }
  }, [instance, accounts]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // ---- Favorit-toggle -----------------------------------------------------------
  const toggleFavorite = async (player) => {
    try {
      const apiScopeStr = process.env.REACT_APP_API_SCOPE || '';
      const scopes = apiScopeStr
        ? apiScopeStr.split(',').map(s => s.trim()).filter(Boolean)
        : [`api://${process.env.REACT_APP_API_CLIENT_ID}/.default`];

      let headers = { 'Content-Type': 'application/json' };
      try {
        const tokenResp = await instance.acquireTokenSilent({ scopes, account: accounts[0] });
        if (tokenResp?.accessToken) headers.Authorization = `Bearer ${tokenResp.accessToken}`;
      } catch (_) { /* dev utan token */ }
      headers['x-dev-coachid'] = accounts?.[0]?.username || accounts?.[0]?.localAccountId || 'local-dev';

      if (favorites.has(player.id)) {
        await fetch(`${API_BASE}/favorites`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ playerId: player.id })
        });
        const next = new Set(favorites);
        next.delete(player.id);
        setFavorites(next);
        setRowData(prev => prev.map(r => r.id === player.id ? { ...r, isFavorite: false } : r));
      } else {
        await fetch(`${API_BASE}/favorites`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ playerId: player.id })
        });
        const next = new Set(favorites);
        next.add(player.id);
        setFavorites(next);
        setRowData(prev => prev.map(r => r.id === player.id ? { ...r, isFavorite: true } : r));
      }
    } catch (e) {
      console.error('Toggle favorite failed:', e);
    }
  };

  // ---- Spara rating/kommentar --------------------------------------------------
  const savePlayerData = async (playerId, data) => {
    try {
      const apiScopeStr = process.env.REACT_APP_API_SCOPE || '';
      const scopes = apiScopeStr
        ? apiScopeStr.split(',').map(s => s.trim()).filter(Boolean)
        : [`api://${process.env.REACT_APP_API_CLIENT_ID}/.default`];

      let headers = { 'Content-Type': 'application/json' };
      try {
        const tokenResp = await instance.acquireTokenSilent({ scopes, account: accounts[0] });
        if (tokenResp?.accessToken) headers.Authorization = `Bearer ${tokenResp.accessToken}`;
      } catch (_) { /* fallback dev-mode */ }

      const response = await axios.post(`${API_BASE}/district/players/${playerId}/ratings`, data, { headers });
      console.log('✔️ Betyg sparat:', response.data);
    } catch (err) {
      console.error('❌ Kunde inte spara betyg:', err?.response?.data || err.message);
    }
  };

  // ---- Grid handlers ------------------------------------------------------------
  const onCellValueChanged = async (params) => {
    const campIndex = params.colDef.campIndex;
    const cat = params.colDef.cat;
    let needSave = false;

    if (cat) {
      if (!params.data.ratings) params.data.ratings = [{},{},{},{},{}];
      if (!params.data.ratings[campIndex]) params.data.ratings[campIndex] = {};
      if (params.oldValue !== params.newValue) {
        params.data.ratings[campIndex][cat] = params.newValue;
        params.data.ratings[campIndex].by = currentUser;
        params.data.ratings[campIndex].timestamp = new Date().toISOString();
        needSave = true;
        params.api.refreshCells({ columns: [`average_${campIndex}`], rowNodes: [params.node], force: true });
      }
    } else if (params.colDef.headerName === 'Kommentarer') {
      // Säkra comments-array + element
      if (!params.data.comments) {
        params.data.comments = [
          { value: '', by: '', timestamp: '' },
          { value: '', by: '', timestamp: '' },
          { value: '', by: '', timestamp: '' },
          { value: '', by: '', timestamp: '' },
          { value: '', by: '', timestamp: '' },
        ];
      }
      if (!params.data.comments[campIndex]) {
        params.data.comments[campIndex] = { value: '', by: '', timestamp: '' };
      }

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

  // ---- Betygs-helpers -----------------------------------------------------------
  const gradeToNumber = (grade) => {
    const map = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0 };
    return map[grade] || 0;
  };

  const calculateAverage = (rating) => {
    const values = categories.map(key => gradeToNumber(rating?.[key] || 'F'));
    const averageNum = (values.reduce((a, b) => a + b, 0) / categories.length);
    return ['A', 'B', 'C', 'D', 'E', 'F'][5 - Math.round(averageNum)];
  };

  const ratingAverageRenderer = (params, campIndex) => {
    const rating = (params.data?.ratings && params.data.ratings[campIndex]) ? params.data.ratings[campIndex] : {};
    const averageGrade = calculateAverage(rating);
    const by = rating.by ? ` by ${rating.by}` : '';
    const ts = rating.timestamp ? ` at ${new Date(rating.timestamp).toLocaleString()}` : '';
    return averageGrade + ' (genomsnitt)' + by + ts;
  };

  const commentsRenderer = (params, campIndex) => {
    const comment = (params.data?.comments && params.data.comments[campIndex])
      ? params.data.comments[campIndex]
      : { value: '', by: '', timestamp: '' };
    const value = comment.value || '';
    const by = comment.by ? ` by ${comment.by}` : '';
    const ts = comment.timestamp ? ` at ${new Date(comment.timestamp).toLocaleString()}` : '';
    return value + by + ts;
  };

  const onGridReady = (params) => {
    gridRef.current.api = params.api;
  };

  // ---- Heart cell ---------------------------------------------------------------
  const HeartCell = (props) => {
    const isFav = props.data?.isFavorite;
    const onClick = () => toggleFavorite(props.data);
    return (
      <span style={{ cursor: 'pointer', fontSize: '18px' }} onClick={onClick}>
        {isFav ? '❤️' : '🤍'}
      </span>
    );
  };

  // ---- Column defs --------------------------------------------------------------
  const columnDefs = useMemo(() => [
    {
      headerName: '❤',
      width: 80,
      pinned: 'left',
      cellRenderer: HeartCell
    },
    { headerName: 'Spelarnamn', field: 'spelarnamn', sortable: true, filter: true, pinned: 'left' },
    { headerName: 'Kön', field: 'kon', sortable: true, filter: true },
    { headerName: 'Ålderspelare', field: 'alderspelare', sortable: true, filter: true },
    { headerName: 'Klubblag', field: 'klubblag', sortable: true, filter: true },
    { headerName: 'Basket Position', field: 'basket_position', sortable: true, filter: true },
    { headerName: 'Aktuell Serie', field: 'aktuellserie', sortable: true, filter: true },
    { headerName: 'Mobilnummer', field: 'mobilnummer', sortable: true, filter: true },
    { headerName: 'Spelarmejl', field: 'spelarmejl', sortable: true, filter: true },
    { headerName: 'T-Shirt storlek', field: 'tshirt_storlek', sortable: true, filter: true },
    { headerName: 'Föräldrar namn', field: 'name', sortable: true, filter: true },
    { headerName: 'Föräldrar Email', field: 'email', sortable: true, filter: true },
    { headerName: 'Föräldrar Telefon', field: 'phone', sortable: true, filter: true },
    { headerName: 'Föräldrar Adress', field: 'address', sortable: true, filter: true },
    ...camps.flatMap((camp, campIndex) => [
      {
        headerName: `${camp} Anmäld`,
        valueGetter: (params) => {
          const regs = params.data?.registeredCamps;
          return (Array.isArray(regs) && regs[campIndex]) ? 'Ja' : 'Nej';
        },
        width: 120
      },
      {
        headerName: camp,
        headerClass: `camp-header-${campIndex}`,
        children: [
          ...categories.map((cat, catIndex) => ({
            headerName: categoryTitles[catIndex],
            editable: (params) => !!params.data?.registeredCamps?.[campIndex],
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: ['A', 'B', 'C', 'D', 'E', 'F'] },
            valueGetter: (params) => {
              const ratings = params.data?.ratings;
              if (!Array.isArray(ratings) || !ratings[campIndex]) return 'F';
              return ratings[campIndex][cat] || 'F';
            },
            valueSetter: (params) => {
              if (!params.data.ratings) params.data.ratings = [{},{},{},{},{}];
              if (!params.data.ratings[campIndex]) params.data.ratings[campIndex] = {};
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
            valueGetter: (params) => calculateAverage(params.data?.ratings?.[campIndex] || {}),
            colId: `average_${campIndex}`
          },
          {
            headerName: 'Kommentarer',
            editable: (params) => !!params.data?.registeredCamps?.[campIndex],
            cellEditor: 'agLargeTextCellEditor',
            cellRenderer: (params) => commentsRenderer(params, campIndex),
            width: 300,
            valueGetter: (params) => {
              const comments = params.data?.comments;
              if (!Array.isArray(comments) || !comments[campIndex]) return '';
              return comments[campIndex].value || '';
            },
            valueSetter: (params) => {
              if (!params.data.comments) {
                params.data.comments = [
                  { value:'',by:'',timestamp:'' },
                  { value:'',by:'',timestamp:'' },
                  { value:'',by:'',timestamp:'' },
                  { value:'',by:'',timestamp:'' },
                  { value:'',by:'',timestamp:'' }
                ];
              }
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
  ], [toggleFavorite, ratingAverageRenderer, calculateAverage, onCellValueChanged, HeartCell]);

  // ---- Filter “visa favoriter” --------------------------------------------------
  const displayRows = useMemo(() => {
    return showOnlyFavorites ? rowData.filter(r => r.isFavorite) : rowData;
  }, [rowData, showOnlyFavorites]);

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
          
          <Button style={{ backgroundColor: 'lightgreen' }} size='sm' ml='2' onClick={onOpen}>Betyg system för spelare</Button>
          <Button style={{ backgroundColor: 'lightblue' }} size='sm' ml='2' onClick={() => setShowOnlyFavorites(v => !v)}>
            {showOnlyFavorites ? 'Visa alla' : 'Visa favoriter'}
          </Button>
        </Flex>
      </Flex>
      <Text mb='4' color='secondaryGray.700'>Du ser endast godkända och registrerade spelare, scrolla för att hitta till olika läger. 
        Du kan endast ge betyg till spelare för det specifika lägret när spelare är anmäld. Osäker? Se BETYG systemet för att kunna klassa spelare med betyg.
      </Text>

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
          rowData={displayRows}
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
            <Text mb="4">
              Ange betyg för varje läger och kategori A-F, där A är högsta betyget.
              All betyg synkas och räknas ut snittet på spelarens läger status. Grunden är F i betyg. 
            </Text>
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