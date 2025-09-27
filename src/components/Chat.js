import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Flex,
  Input,
  Button,
  Text,
  VStack,
  Avatar,
  useColorModeValue,
  IconButton,
  Badge,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Tab,
  List,
  ListItem,
  HStack,
  InputGroup,
  InputRightElement,
  Textarea,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Checkbox,
  CheckboxGroup,
} from '@chakra-ui/react';
import { FaCommentDots } from 'react-icons/fa';
import axios from 'axios';
import { FiPaperclip, FiSmile, FiMic, FiHome, FiMessageSquare, FiHelpCircle, FiBell, FiX } from 'react-icons/fi';
import { sendMessage, onReceiveMessage, joinGroup, fetchUsers, createGroup, fetchGroups, connectChat } from '../services/chatService';

/**
 * Intercom‑style chat widget
 * - Floating bubble bottom‑right
 * - Drawer panel with a two‑pane layout: groups (left) + conversation (right)
 * - Clean header, sticky composer, empty states
 * - Multiline composer (Shift+Enter = newline, Enter = send)
 * - Group create flow uses CheckboxGroup (Chakra Select does not support multiple)
 * - Hooks into existing chatService functions without changing API
 */

const Chat = () => {
  // data state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [search, setSearch] = useState('');

  const [activeTab, setActiveTab] = useState('messages'); // 'home' | 'messages' | 'help' | 'news'
  const canDelete = true; // TODO: role-based
  const usersById = useRef({});

  // create-group state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState([]);

  const messagesEndRef = useRef(null);
  const selectedGroupRef = useRef(null);

  const surface = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const bubbleBgMe = useColorModeValue('blackAlpha.900', 'blackAlpha.900');
  const bubbleBgOther = useColorModeValue('gray.100', 'gray.700');
  const textColorMe = 'white';
  const textColorOther = useColorModeValue('black', 'white');

  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');

  // Precompute additional color tokens once at the top
  const leftBg = useColorModeValue('gray.50', 'gray.800');
  const chipBg = useColorModeValue('gray.100', 'gray.700');
  const footerInputBg = useColorModeValue('white', 'gray.700');

  // bootstrap (data only)
  useEffect(() => {
    fetchUsers().then((arr) => {
      setUsers(arr);
      const map = {};
      (arr || []).forEach(u => { map[u.id] = u; });
      usersById.current = map;
    }).catch(console.error);
    fetchGroups().then(setGroups).catch(console.error);
  }, []);

  // connect socket + subscribe when widget opens
  useEffect(() => {
    if (!isOpen) return;
    connectChat();
    const messageListener = (data) => {
      if (data.groupId === selectedGroupRef.current) {
        setMessages((prev) => [...prev, data]);
      }
    };
    const unsubscribe = onReceiveMessage(messageListener);
    // if a group is already selected, (re)join after connect
    if (selectedGroupRef.current) {
      joinGroup(selectedGroupRef.current);
    }
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isOpen]);

  const fetchHistory = async (groupId) => {
    try {
      const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || '/api';
      const { data } = await axios.get(`${base}/chat/groups/${groupId}/messages?limit=50`);
      return (data || []).reverse().map(m => ({ user: m.senderName || m.user || 'User', message: m.text || m.message, groupId: m.groupId }));
    } catch (e) {
      console.error('history failed', e?.message);
      return [];
    }
  };

  // join & load messages when group changes
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
    if (selectedGroup) {
      joinGroup(selectedGroup);
      fetchHistory(selectedGroup).then(setMessages);
    } else {
      setMessages([]);
    }
  }, [selectedGroup, groups]);

  // autoscroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedGroup) return;
    const text = input.trim();
    // Optimistic render so the user sees the message instantly
    setMessages((prev) => [
      ...prev,
      { user: 'Me', message: text, groupId: selectedGroup, optimistic: true },
    ]);
    setInput('');
    setIsSending(true);
    try {
      await sendMessage(selectedGroup, text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const group = await createGroup(newGroupName.trim(), newGroupMembers);
      setGroups((prev) => [...prev, group]);
      setNewGroupName('');
      setNewGroupMembers([]);
      setSelectedGroup(group.id);
      joinGroup(group.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    try {
      const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || '/api';
      await axios.delete(`${base}/chat/groups/${selectedGroup}`);
      setGroups(prev => prev.filter(g => g.id !== selectedGroup));
      setSelectedGroup(null);
      setMessages([]);
    } catch (e) {
      console.error('delete group failed', e?.message);
    }
  };

  // simple client filter for groups list
  const filteredGroups = groups.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Floating bubble */}
      <IconButton
        icon={<FaCommentDots />}
        position="fixed"
        bottom="20px"
        right="20px"
        size="lg"
        colorScheme="blue"
        aria-label="Öppna chat"
        zIndex={1400}
        onClick={() => setIsOpen(true)}
        borderRadius="full"
        shadow="xl"
      />

      {/* Drawer panel */}
      <Drawer isOpen={isOpen} placement="right" onClose={() => setIsOpen(false)} size="xs">
        <DrawerOverlay />
        <DrawerContent
          bg={surface}
          w={{ base: '100vw', md: '460px' }}
          maxW={{ base: '100vw', md: '460px' }}
          h="100vh"
          my={0}
          borderRadius={{ base: 0, md: '2xl' }}
          overflow="hidden"
          shadow="xl"
          borderWidth={{ base: 0, md: '1px' }}
        >
          <DrawerHeader borderBottomWidth="1px" py={3}>
            <Flex align="center" justify="space-between">
              <Box w={6} />
              <Text fontWeight="bold">Meddelanden</Text>
              <IconButton aria-label="Stäng" icon={<FiX />} variant="ghost" onClick={() => setIsOpen(false)} />
            </Flex>
          </DrawerHeader>

          <DrawerBody p={0}>
            {activeTab === 'messages' ? (
              <Flex h="full" minH="500px">
                {/* Left: groups / users / create */}
                <Box w={{ base: '42%', md: '34%' }} maxW="220px" borderRight="1px solid" borderColor={border} bg={leftBg} borderRightRadius="xl">
                  <Tabs variant="enclosed" size="sm" isFitted>
                    <TabList>
                      <Tab>Grupper</Tab>
                      <Tab>Skapa</Tab>
                    </TabList>
                    <TabPanels>
                      {/* Groups */}
                      <TabPanel p={3}>
                        <InputGroup size="sm" mb={2}>
                          <Input
                            placeholder="Sök grupp"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          <InputRightElement>{filteredGroups.length === 0 && <Text fontSize="xs">0</Text>}</InputRightElement>
                        </InputGroup>
                        <List spacing={1} maxH="calc(100vh - 270px)" overflowY="auto">
                          {filteredGroups.map((group) => (
                          <ListItem
                            key={group.id}
                            px={2}
                            py={3}
                            borderRadius="md"
                            _hover={{ bg: hoverBg, cursor: 'pointer' }}
                            bg={selectedGroup === group.id ? selectedBg : 'transparent'}
                            onClick={() => setSelectedGroup(group.id)}
                          >
                              <HStack justify="space-between">
                                <Text noOfLines={1}>{group.name}</Text>
                                {group.unread > 0 && <Badge colorScheme="blue">{group.unread}</Badge>}
                              </HStack>
                            </ListItem>
                          ))}
                          {filteredGroups.length === 0 && (
                            <Text fontSize="sm" color="gray.500" mt={2}>Inga grupper</Text>
                          )}
                        </List>
                      </TabPanel>

                      {/* Create group */}
                      <TabPanel p={3}>
                        <Input
                          placeholder="Gruppnamn"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          mb={3}
                        />
                        <Text mb={2} fontWeight="bold">Välj medlemmar</Text>
                        <Box borderWidth="1px" borderRadius="md" p={2} maxH="220px" overflowY="auto">
                          <CheckboxGroup value={newGroupMembers} onChange={(vals) => setNewGroupMembers(vals)}>
                            <VStack align="stretch" spacing={2}>
                              {users.map((u) => (
                                <Checkbox key={u.id} value={u.id}>{u.displayName}</Checkbox>
                              ))}
                            </VStack>
                          </CheckboxGroup>
                        </Box>
                        <Button mt={3} colorScheme="blue" variant="solid" onClick={handleCreateGroup} isDisabled={!newGroupName.trim()}>
                          Skapa grupp
                        </Button>
                      </TabPanel>
                    </TabPanels>
                  </Tabs>
                </Box>

                {/* Right: conversation */}
                <Flex direction="column" flex={1}>
                  {/* Empty state */}
                  {!selectedGroup && (
                    <Flex flex={1} align="center" justify="center">
                      <VStack spacing={2}>
                        <Text fontSize="lg" fontWeight="bold">Välj en grupp för att börja chatta</Text>
                        <Text color="gray.500">Skapa en ny grupp eller välj en befintlig till vänster.</Text>
                      </VStack>
                    </Flex>
                  )}

                  {selectedGroup && (
                    <>
                      <Flex align="center" justify="space-between" px={4} py={3} borderBottom="1px solid" borderColor={border}>
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="bold">
                            {groups.find((g) => g.id === selectedGroup)?.name || 'Konversation'}
                          </Text>
                          <HStack spacing={2} wrap="wrap">
                            {(groups.find(g => g.id === selectedGroup)?.members || []).map(mid => {
                              const u = usersById.current[mid];
                              const label = u?.displayName || u?.userPrincipalName || 'Medlem';
                              return (
                                <HStack key={mid} spacing={1} px={2} py={1} borderRadius="full" bg={chipBg}>
                                  <Avatar name={label} size="xs" />
                                  <Text fontSize="xs">{label}</Text>
                                </HStack>
                              );
                            })}
                          </HStack>
                        </VStack>
                        {canDelete && (
                          <Button size="sm" variant="ghost" colorScheme="red" onClick={handleDeleteGroup} borderRadius="full">
                            Radera
                          </Button>
                        )}
                      </Flex>

                      <VStack spacing={4} flex={1} overflowY="auto" p={4} align="stretch">
                        {messages.map((msg, i) => (
                          <Flex key={i} justify={msg.user === 'Me' ? 'flex-end' : 'flex-start'}>
                            {msg.user !== 'Me' && <Avatar name={msg.user} mr={2} size="sm" />}
                            <Box
                              bg={msg.user === 'Me' ? bubbleBgMe : bubbleBgOther}
                              color={msg.user === 'Me' ? textColorMe : textColorOther}
                              px={3}
                              py={2}
                              borderRadius="lg"
                              maxW="85%"
                              shadow="xs"
                            >
                              <Text fontWeight="semibold" fontSize="sm">{msg.user}</Text>
                              <Text whiteSpace="pre-wrap">{msg.message}</Text>
                            </Box>
                            {msg.user === 'Me' && <Avatar name={msg.user} ml={2} size="sm" />}
                          </Flex>
                        ))}
                        <div ref={messagesEndRef} />
                      </VStack>
                    </>
                  )}
                </Flex>
              </Flex>
            ) : (
              <Flex h="full" align="center" justify="center" p={6}>
                <VStack spacing={4}>
                  <Text fontSize="lg" fontWeight="bold">
                    {activeTab === 'home' && 'Hej 👋 Hur kan vi hjälpa till?'}
                    {activeTab === 'help' && 'Hjälp'}
                    {activeTab === 'news' && 'Nyheter'}
                  </Text>
                  <Text color="gray.500">Det här avsnittet är på väg. Under tiden kan du växla till Meddelanden för att chatta.</Text>
                </VStack>
              </Flex>
            )}
          </DrawerBody>

          <DrawerFooter borderTopWidth="1px" py={4}>
            {activeTab === 'messages' ? (
              <VStack w="full" spacing={3}>
                <Flex w="full" align="center" gap={4}>
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedGroup ? 'Meddelande…' : 'Välj en grupp för att börja'}
                    bg={footerInputBg}
                    isDisabled={!selectedGroup}
                    rows={1}
                    resize="none"
                    minH="48px"
                    px={4}
                    py={3}
                    borderRadius="full"
                    borderWidth="1px"
                  />
                  <HStack spacing={2}>
                    <IconButton aria-label="Bifoga" icon={<FiPaperclip />} variant="ghost" size="md" borderRadius="full" />
                    <IconButton aria-label="Emoji" icon={<FiSmile />} variant="ghost" size="md" borderRadius="full" />
                    <IconButton aria-label="Mikrofon" icon={<FiMic />} variant="ghost" size="md" borderRadius="full" />
                  </HStack>
                  <Button colorScheme="blue" onClick={handleSend} isDisabled={!selectedGroup || !input.trim()} isLoading={isSending} borderRadius="full" px={6} h="48px">
                    Skicka
                  </Button>
                </Flex>
                <Divider />
                <HStack w="full" justify="space-around" pt={2} spacing={4}>
                  <Button onClick={() => setActiveTab('home')} variant={activeTab==='home'?'solid':'ghost'} leftIcon={<FiHome />} borderRadius="full">Hem</Button>
                  <Button onClick={() => setActiveTab('messages')} variant={activeTab==='messages'?'solid':'ghost'} leftIcon={<FiMessageSquare />} borderRadius="full">Meddelanden</Button>
                  <Button onClick={() => setActiveTab('help')} variant={activeTab==='help'?'solid':'ghost'} leftIcon={<FiHelpCircle />} borderRadius="full">Hjälp</Button>
                  <Button onClick={() => setActiveTab('news')} variant={activeTab==='news'?'solid':'ghost'} leftIcon={<FiBell />} borderRadius="full">Nyheter</Button>
                </HStack>
              </VStack>
            ) : (
              <HStack w="full" justify="space-around">
                <Button onClick={() => setActiveTab('home')} variant={activeTab==='home'?'solid':'ghost'} leftIcon={<FiHome />} borderRadius="full">Hem</Button>
                <Button onClick={() => setActiveTab('messages')} variant={activeTab==='messages'?'solid':'ghost'} leftIcon={<FiMessageSquare />} borderRadius="full">Meddelanden</Button>
                <Button onClick={() => setActiveTab('help')} variant={activeTab==='help'?'solid':'ghost'} leftIcon={<FiHelpCircle />} borderRadius="full">Hjälp</Button>
                <Button onClick={() => setActiveTab('news')} variant={activeTab==='news'?'solid':'ghost'} leftIcon={<FiBell />} borderRadius="full">Nyheter</Button>
              </HStack>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default Chat;