// Chakra Imports
import {
  Avatar,
  Flex,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useColorModeValue,
  Box,
} from '@chakra-ui/react';
// Custom Components
import { SearchBar } from 'components/navbar/searchBar/SearchBar';
import { SidebarResponsive } from 'components/sidebar/Sidebar';
import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
// Assets
import { MdNotificationsNone } from 'react-icons/md';
import { FaEthereum } from 'react-icons/fa';
import routes from 'routes';
import { useMsal } from '@azure/msal-react';
import { Link as RouterLink } from 'react-router-dom';

// LocalStorage keys
const ADMIN_LS_KEY = 'adminNotifications'; // populated by /admin/notifications UI

export default function HeaderLinks(props) {
  const { secondary } = props;
  const { accounts, instance } = useMsal();
  const userName = accounts[0]?.name || 'Användare';
  const accountId = accounts[0]?.homeAccountId || 'anon';
  const RECEIPTS_KEY = `hub.notifications.receipts.${accountId}`; // per-user read receipts

  // Chakra Color Mode
  const navbarIcon = useColorModeValue('gray.400', 'white');
  let menuBg = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const textColorBrand = useColorModeValue('brand.700', 'brand.400');
  const ethColor = useColorModeValue('gray.700', 'white');
  const borderColor = useColorModeValue('#E6ECFA', 'rgba(135, 140, 189, 0.3)');
  const ethBg = useColorModeValue('secondaryGray.300', 'navy.900');
  const ethBox = useColorModeValue('white', 'navy.800');
  const shadow = useColorModeValue(
    '14px 17px 40px 4px rgba(112, 144, 176, 0.18)',
    '14px 17px 40px 4px rgba(112, 144, 176, 0.06)'
  );

  // ---------------------------
  // Notifications (read-only from admin LS) + per-user read receipts
  // ---------------------------
  const [notifications, setNotifications] = useState([]); // published only
  const [receipts, setReceipts] = useState({}); // { [id]: true }

  const loadFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(ADMIN_LS_KEY);
      const all = raw ? JSON.parse(raw) : [];
      const published = Array.isArray(all)
        ? all
            .filter((n) => n.status === 'published')
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 10) // cap dropdown
        : [];
      setNotifications(published);
    } catch (e) {
      console.warn('Kunde inte läsa admin-notiser:', e);
      setNotifications([]);
    }

    try {
      const r = localStorage.getItem(RECEIPTS_KEY);
      setReceipts(r ? JSON.parse(r) : {});
    } catch (e) {
      console.warn('Kunde inte läsa read receipts:', e);
      setReceipts({});
    }
  }, [RECEIPTS_KEY]);

  // Initial + keep in sync when storage changes (other tabs/admin page)
  useEffect(() => {
    loadFromStorage();
    const onStorage = (e) => {
      if (e.key === ADMIN_LS_KEY || e.key === RECEIPTS_KEY) {
        loadFromStorage();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadFromStorage, RECEIPTS_KEY]);

  // Persist receipts on change
  useEffect(() => {
    try {
      localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
    } catch (e) {
      console.warn('Kunde inte spara read receipts:', e);
    }
  }, [RECEIPTS_KEY, receipts]);

  const unreadCount = useMemo(() => {
    return notifications.reduce((acc, n) => (receipts[n.id] ? acc : acc + 1), 0);
  }, [notifications, receipts]);

  const markAllRead = () => {
    setReceipts((prev) => {
      const next = { ...prev };
      notifications.forEach((n) => {
        next[n.id] = true;
      });
      return next;
    });
  };

  const toggleRead = (id) => {
    setReceipts((prev) => ({ ...prev, [id]: prev[id] ? undefined : true }));
  };

  const handleLogout = async () => {
    await instance.logoutRedirect({
      postLogoutRedirectUri: 'https://hub.mirzamuhic.com/logout',
    });
  };

  return (
    <Flex
      w={{ sm: '100%', md: 'auto' }}
      alignItems="center"
      flexDirection="row"
      bg={menuBg}
      flexWrap={secondary ? { base: 'wrap', md: 'nowrap' } : 'unset'}
      p="10px"
      borderRadius="30px"
      boxShadow={shadow}
    >
      <SearchBar
        mb={() => {
          if (secondary) {
            return { base: '10px', md: 'unset' };
          }
          return 'unset';
        }}
        me="10px"
        borderRadius="30px"
      />

      <Flex
        bg={ethBg}
        display={secondary ? 'flex' : 'none'}
        borderRadius="30px"
        ms="auto"
        p="6px"
        align="center"
        me="6px"
      >
        <Flex
          align="center"
          justify="center"
          bg={ethBox}
          h="29px"
          w="29px"
          borderRadius="30px"
          me="7px"
        >
          <Icon color={ethColor} w="9px" h="14px" as={FaEthereum} />
        </Flex>
        <Text w="max-content" color={ethColor} fontSize="sm" fontWeight="700" me="6px">
          1,924
          <Text as="span" display={{ base: 'none', md: 'unset' }}> ETH</Text>
        </Text>
      </Flex>

      <SidebarResponsive routes={routes} />

      {/* Notifications */}
      <Menu>
        <MenuButton p="0px">
          <Box position="relative" me="10px">
            <Icon mt="6px" as={MdNotificationsNone} color={navbarIcon} w="18px" h="18px" aria-label="Notiser" />
            {unreadCount > 0 && (
              <Box
                as="span"
                position="absolute"
                top="-2px"
                right="-6px"
                bg="red.500"
                color="white"
                borderRadius="full"
                fontSize="10px"
                lineHeight="14px"
                minW="16px"
                h="16px"
                textAlign="center"
                px="4px"
              >
                {unreadCount}
              </Box>
            )}
          </Box>
        </MenuButton>

        <MenuList
          boxShadow={shadow}
          p="20px"
          borderRadius="20px"
          bg={menuBg}
          border="none"
          mt="22px"
          me={{ base: '30px', md: 'unset' }}
          minW={{ base: 'unset', md: '400px', xl: '450px' }}
          maxW={{ base: '360px', md: 'unset' }}
        >
          <Flex w="100%" mb="20px" align="center">
            <Text fontSize="md" fontWeight="600" color={textColor}>Notiser</Text>
            <Box
              as="button"
              fontSize="sm"
              fontWeight="500"
              color={useColorModeValue('gray.500', 'gray.300')}
              bg={useColorModeValue('gray.100', 'whiteAlpha.200')}
              px="12px"
              py="4px"
              borderRadius="full"
              _hover={{ bg: useColorModeValue('gray.200', 'whiteAlpha.300') }}
              onClick={markAllRead}
            >
              Markera alla som lästa
            </Box>
          </Flex>

          <Flex flexDirection="column">
            {notifications.length === 0 && (
              <Text color={textColor} fontSize="sm">Inga publicerade notiser.</Text>
            )}

            {notifications.map((n) => {
              const isRead = !!receipts[n.id];
              return (
                <MenuItem
                  key={n.id}
                  _hover={{ bg: 'none' }}
                  _focus={{ bg: 'none' }}
                  px="0"
                  borderRadius="8px"
                  mb="10px"
                  color={isRead ? 'gray.500' : textColor}
                  onClick={() => toggleRead(n.id)}
                >
                  <Flex direction="column" w="100%">
                    <Text fontWeight="600" noOfLines={1}>
                      {n.title || (n.message ? n.message.substring(0, 80) : 'Notis')}
                    </Text>
                    {n.title && n.message && (
                      <Text fontSize="sm" opacity={0.85} noOfLines={2}>
                        {n.message}
                      </Text>
                    )}
                  </Flex>
                </MenuItem>
              );
            })}
          </Flex>
        </MenuList>
      </Menu>

      {/* User */}
      <Menu>
        <MenuButton p="0px">
          <Avatar
            _hover={{ cursor: 'pointer' }}
            color="white"
            name={userName}
            bg="#11047A"
            size="sm"
            w="40px"
            h="40px"
          />
        </MenuButton>
        <MenuList boxShadow={shadow} p="0px" mt="10px" borderRadius="20px" bg={menuBg} border="none">
          <Flex w="100%" mb="0px">
            <Text
              ps="20px"
              pt="16px"
              pb="10px"
              w="100%"
              borderBottom="1px solid"
              borderColor={borderColor}
              fontSize="sm"
              fontWeight="700"
              color={textColor}
            >
              👋&nbsp; Hej, {userName}
            </Text>
          </Flex>
          <Flex flexDirection="column" p="10px">
            <MenuItem _hover={{ bg: 'none' }} _focus={{ bg: 'none' }} borderRadius="8px" px="14px" as={RouterLink} to="/admin/profile">
              <Text fontSize="sm">Min Profil</Text>
            </MenuItem>
            <MenuItem
              _hover={{ bg: 'none' }}
              _focus={{ bg: 'none' }}
              color="red.400"
              borderRadius="8px"
              px="14px"
              onClick={async () => {
                await instance.logoutRedirect({ postLogoutRedirectUri: 'https://hub.mirzamuhic.com/logout' });
              }}
            >
              <Text fontSize="sm">Logga ut</Text>
            </MenuItem>
          </Flex>
        </MenuList>
      </Menu>
    </Flex>
  );
}

HeaderLinks.propTypes = {
  variant: PropTypes.string,
  fixed: PropTypes.bool,
  secondary: PropTypes.bool,
  onOpen: PropTypes.func,
};