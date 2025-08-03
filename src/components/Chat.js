// src/components/Chat.js (full)
import React, { useState, useEffect, useRef } from 'react';
import { Box, Flex, Input, Button, Text, VStack, Avatar, useColorModeValue, Popover, PopoverTrigger, PopoverContent, IconButton, Badge, Divider, Tabs, TabList, TabPanels, TabPanel, Tab, Select, List, ListItem } from '@chakra-ui/react';
import { FaCommentDots } from 'react-icons/fa';
import { sendMessage, onReceiveMessage, onOnlineUsers, joinGroup, fetchUsers, createGroup, fetchGroups } from '../services/chatService';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState([]);
  const messagesEndRef = useRef(null);

  const bg = useColorModeValue('white', 'gray.800');
  const inputBg = useColorModeValue('gray.100', 'gray.700');
  const bubbleBgMe = 'blue.500';
  const bubbleBgOther = 'gray.300';
  const textColorMe = 'white';
  const textColorOther = 'black';

  useEffect(() => {
    fetchUsers().then(setUsers).catch(console.error);
    fetchGroups().then(setGroups).catch(console.error);
    onReceiveMessage((data) => {
      if (data.groupId === selectedGroup) {
        setMessages((prev) => [...prev, data]);
      }
    });
    onOnlineUsers((users) => setOnlineUsers(users));
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      joinGroup(selectedGroup);
      const group = groups.find(g => g.id === selectedGroup);
      if (group) setMessages(group.messages || []);
    }
  }, [selectedGroup, groups]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && selectedGroup) {
      sendMessage(selectedGroup, input);
      setInput('');
    }
  };

  const handleCreateGroup = () => {
    createGroup(newGroupName, newGroupMembers).then((group) => {
      setGroups([...groups, group]);
      setNewGroupName('');
      setNewGroupMembers([]);
    }).catch(console.error);
  };

  const handleSelectMember = (e) => {
    const userId = e.target.value;
    setNewGroupMembers((prev) => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  return (
    <Popover placement="top-end">
      <PopoverTrigger>
        <IconButton
          icon={<FaCommentDots />}
          position="fixed"
          bottom="20px"
          right="20px"
          size="lg"
          colorScheme="blue"
          aria-label="Chat"
        />
      </PopoverTrigger>
      <PopoverContent w="400px" h="600px" p={0} borderRadius="lg" shadow="xl">
        <Flex direction="column" h="full">
          <Box p={4} bg="blue.500" color="white">
            <Text fontWeight="bold">Intern Chat</Text>
          </Box>
          <Tabs variant="enclosed" flex={1}>
            <TabList>
              <Tab>Grupper</Tab>
              <Tab>Användare</Tab>
              <Tab>Skapa Grupp</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <List spacing={3}>
                  {groups.map((group) => (
                    <ListItem key={group.id} onClick={() => setSelectedGroup(group.id)} cursor="pointer">
                      {group.name}
                    </ListItem>
                  ))}
                </List>
              </TabPanel>
              <TabPanel>
                <Box p={4} borderBottom="1px solid gray">
                  <Text fontWeight="bold">Online Användare</Text>
                  <Flex wrap="wrap">
                    {onlineUsers.map((user, i) => (
                      <Badge key={i} m={1} colorScheme="green">{user}</Badge>
                    ))}
                  </Flex>
                </Box>
                <Text fontWeight="bold">Alla Användare</Text>
                <List spacing={3}>
                  {users.map((user) => (
                    <ListItem key={user.id}>
                      {user.displayName} ({user.userPrincipalName})
                    </ListItem>
                  ))}
                </List>
              </TabPanel>
              <TabPanel>
                <Input placeholder="Gruppnamn" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} mb={2} />
                <Text mb={2}>Välj medlemmar</Text>
                <Select multiple onChange={handleSelectMember} height="100px">
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.displayName}</option>
                  ))}
                </Select>
                <Button mt={2} onClick={handleCreateGroup}>Skapa</Button>
              </TabPanel>
            </TabPanels>
          </Tabs>
          {selectedGroup && (
            <>
              <VStack spacing={4} flex={1} overflowY="auto" p={4} align="stretch">
                {messages.map((msg, i) => (
                  <Flex key={i} justify={msg.user === 'Me' ? 'flex-end' : 'flex-start'}>
                    {msg.user !== 'Me' && <Avatar name={msg.user} mr={2} />}
                    <Box
                      bg={msg.user === 'Me' ? bubbleBgMe : bubbleBgOther}
                      color={msg.user === 'Me' ? textColorMe : textColorOther}
                      p={3}
                      borderRadius="lg"
                      maxW="70%"
                    >
                      <Text fontWeight="bold">{msg.user}</Text>
                      <Text>{msg.message}</Text>
                    </Box>
                    {msg.user === 'Me' && <Avatar name={msg.user} ml={2} />}
                  </Flex>
                ))}
                <div ref={messagesEndRef} />
              </VStack>
              <Divider />
              <Flex p={4}>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Skriv meddelande..."
                  bg={inputBg}
                  mr={2}
                />
                <Button colorScheme="blue" onClick={handleSend}>Skicka</Button>
              </Flex>
            </>
          )}
        </Flex>
      </PopoverContent>
    </Popover>
  );
};

export default Chat;