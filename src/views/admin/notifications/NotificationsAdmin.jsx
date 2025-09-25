import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
  Textarea,
  Badge,
  useDisclosure,
  useColorModeValue,
  Tooltip,
} from '@chakra-ui/react';
import { MdAdd, MdDelete, MdEdit, MdOutlinePublish, MdUnfoldMore, MdOutlineUnpublished, MdRefresh } from 'react-icons/md';

// Priority badge component
function PriorityBadge({ priority }) {
  const colorScheme = {
    low: 'green',
    medium: 'yellow',
    high: 'red',
  }[priority] || 'gray';
  const label = {
    low: 'Låg',
    medium: 'Mellan',
    high: 'Hög',
  }[priority] || priority;
  return <Badge colorScheme={colorScheme}>{label}</Badge>;
}

// Status badge component
function StatusBadge({ status }) {
  const colorScheme = status === 'published' ? 'green' : 'gray';
  const label = status === 'published' ? 'Publicerad' : 'Ej publicerad';
  return <Badge colorScheme={colorScheme}>{label}</Badge>;
}

const NOTIFICATIONS_STORAGE_KEY = 'adminNotifications';

function getInitialNotifications() {
  const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // fallback to default
    }
  }
  // Default demo notifications
  return [
    {
      id: 1,
      title: 'Välkommen till HUB-Sport!',
      message: 'Detta är en testnotis för adminsidan.',
      priority: 'medium',
      status: 'published',
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      title: 'Ny funktion',
      message: 'Nu kan du filtrera notiser!',
      priority: 'low',
      status: 'unpublished',
      createdAt: new Date().toISOString(),
    },
  ];
}

function saveNotifications(notifications) {
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  // Notify other parts of the app (same tab) that notifications changed
  try {
    window.dispatchEvent(new Event('hub-notifications-updated'));
  } catch (_) {
    // no-op
  }
}

export default function NotificationsAdmin() {
  const [notifications, setNotifications] = useState(getInitialNotifications);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [editingNotification, setEditingNotification] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Persist to localStorage
  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  // Filtering and sorting
  const filteredNotifications = useMemo(() => {
    let items = [...notifications];
    if (filterStatus) items = items.filter(n => n.status === filterStatus);
    if (filterPriority) items = items.filter(n => n.priority === filterPriority);
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(
        n =>
          n.title.toLowerCase().includes(s) ||
          n.message.toLowerCase().includes(s)
      );
    }
    items.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'createdAt') {
        cmp = new Date(a.createdAt) - new Date(b.createdAt);
      } else if (sortBy === 'priority') {
        const order = { low: 1, medium: 2, high: 3 };
        cmp = order[a.priority] - order[b.priority];
      } else if (sortBy === 'title') {
        cmp = a.title.localeCompare(b.title);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [notifications, filterStatus, filterPriority, search, sortBy, sortDir]);

  // Modal form state
  const [form, setForm] = useState({
    title: '',
    message: '',
    priority: 'medium',
    status: 'unpublished',
  });

  function resetForm() {
    setForm({
      title: '',
      message: '',
      priority: 'medium',
      status: 'unpublished',
    });
    setEditingNotification(null);
  }

  function handleOpenCreate() {
    resetForm();
    onOpen();
  }

  function handleEdit(n) {
    setForm({
      title: n.title,
      message: n.message,
      priority: n.priority,
      status: n.status,
    });
    setEditingNotification(n);
    onOpen();
  }

  function handleDelete(id) {
    setNotifications(notifications.filter(n => n.id !== id));
  }

  function handlePublishToggle(id) {
    setNotifications(
      notifications.map(n =>
        n.id === id
          ? { ...n, status: n.status === 'published' ? 'unpublished' : 'published' }
          : n
      )
    );
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    if (editingNotification) {
      setNotifications(notifications.map(n =>
        n.id === editingNotification.id ? { ...n, ...form } : n
      ));
    } else {
      setNotifications([
        ...notifications,
        {
          ...form,
          id: Date.now(),
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    onClose();
    resetForm();
  }

  function handleRefresh() {
    setNotifications(getInitialNotifications());
  }

  // UI
  const tableBg = useColorModeValue('white', 'gray.800');

  return (
    <Box px={{ base: 2, md: 6 }} py={4}>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Admin – Notiser</Heading>
        <Button
          leftIcon={<MdAdd />}
          colorScheme="blue"
          onClick={handleOpenCreate}
        >
          Ny notis
        </Button>
      </Flex>

      <Flex mb={4} wrap="wrap" gap={2} align="center">
        <Input
          placeholder="Sök titel eller meddelande..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          maxW="250px"
        />
        <Select
          placeholder="Filtrera status"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          maxW="180px"
        >
          <option value="published">Publicerad</option>
          <option value="unpublished">Ej publicerad</option>
        </Select>
        <Select
          placeholder="Filtrera prioritet"
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          maxW="180px"
        >
          <option value="low">Låg</option>
          <option value="medium">Mellan</option>
          <option value="high">Hög</option>
        </Select>
        <Tooltip label="Återställ till default">
          <IconButton
            aria-label="Återställ"
            icon={<MdRefresh />}
            onClick={handleRefresh}
            variant="ghost"
          />
        </Tooltip>
      </Flex>

      <Box borderRadius="lg" overflow="auto" bg={tableBg} shadow="sm">
        <Table size="md">
          <Thead>
            <Tr>
              <Th>
                <Button
                  size="xs"
                  variant="ghost"
                  rightIcon={<MdUnfoldMore />}
                  onClick={() => {
                    setSortBy('createdAt');
                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  Skapad
                </Button>
              </Th>
              <Th>
                <Button
                  size="xs"
                  variant="ghost"
                  rightIcon={<MdUnfoldMore />}
                  onClick={() => {
                    setSortBy('title');
                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  Titel
                </Button>
              </Th>
              <Th>Meddelande</Th>
              <Th>
                <Button
                  size="xs"
                  variant="ghost"
                  rightIcon={<MdUnfoldMore />}
                  onClick={() => {
                    setSortBy('priority');
                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  Prioritet
                </Button>
              </Th>
              <Th>Status</Th>
              <Th>Åtgärder</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredNotifications.length === 0 ? (
              <Tr>
                <Td colSpan={6}>
                  <Text textAlign="center" color="gray.500">
                    Inga notiser hittades.
                  </Text>
                </Td>
              </Tr>
            ) : (
              filteredNotifications.map(n => (
                <Tr key={n.id}>
                  <Td>
                    <Text fontSize="sm">
                      {new Date(n.createdAt).toLocaleString('sv-SE', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </Text>
                  </Td>
                  <Td fontWeight="semibold">{n.title}</Td>
                  <Td>
                    <Text noOfLines={2} maxW="320px">
                      {n.message}
                    </Text>
                  </Td>
                  <Td>
                    <PriorityBadge priority={n.priority} />
                  </Td>
                  <Td>
                    <StatusBadge status={n.status} />
                  </Td>
                  <Td>
                    <ButtonGroup size="sm" variant="ghost">
                      <Tooltip label="Redigera">
                        <IconButton
                          aria-label="Redigera"
                          icon={<MdEdit />}
                          onClick={() => handleEdit(n)}
                        />
                      </Tooltip>
                      <Tooltip label={n.status === 'published' ? 'Avpublicera' : 'Publicera'}>
                        <IconButton
                          aria-label="Publicera/Avpublicera"
                          icon={
                            n.status === 'published' ? <MdOutlineUnpublished /> : <MdOutlinePublish />
                          }
                          colorScheme={n.status === 'published' ? 'gray' : 'green'}
                          onClick={() => handlePublishToggle(n.id)}
                        />
                      </Tooltip>
                      <Tooltip label="Ta bort">
                        <IconButton
                          aria-label="Ta bort"
                          icon={<MdDelete />}
                          colorScheme="red"
                          onClick={() => handleDelete(n.id)}
                        />
                      </Tooltip>
                    </ButtonGroup>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={() => { onClose(); resetForm(); }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingNotification ? 'Redigera notis' : 'Ny notis'}
          </ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleFormSubmit}>
            <ModalBody>
              <Box mb={3}>
                <Input
                  name="title"
                  placeholder="Titel"
                  value={form.title}
                  onChange={handleFormChange}
                  required
                  maxLength={100}
                  mb={2}
                />
                <Textarea
                  name="message"
                  placeholder="Meddelande"
                  value={form.message}
                  onChange={handleFormChange}
                  required
                  maxLength={500}
                  rows={4}
                  mb={2}
                />
                <HStack mb={2}>
                  <Select
                    name="priority"
                    value={form.priority}
                    onChange={handleFormChange}
                  >
                    <option value="low">Låg</option>
                    <option value="medium">Mellan</option>
                    <option value="high">Hög</option>
                  </Select>
                  <Select
                    name="status"
                    value={form.status}
                    onChange={handleFormChange}
                  >
                    <option value="published">Publicerad</option>
                    <option value="unpublished">Ej publicerad</option>
                  </Select>
                </HStack>
              </Box>
            </ModalBody>
            <ModalFooter>
              <Button onClick={() => { onClose(); resetForm(); }} mr={2}>
                Avbryt
              </Button>
              <Button colorScheme="blue" type="submit">
                {editingNotification ? 'Spara' : 'Skapa'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </Box>
  );
}
