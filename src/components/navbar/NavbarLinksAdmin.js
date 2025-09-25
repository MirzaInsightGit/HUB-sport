// Admin notifications dropdown (Navbar right side)

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Flex,
  Text,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue,
} from "@chakra-ui/react";
import { MdNotificationsNone } from "react-icons/md";
import { useMsal } from "@azure/msal-react";

// LocalStorage keys
const ADMIN_LS_KEY = "adminNotifications"; // list maintained by admin page

export default function AdminNavbarLinks(props) {
  const { instance, accounts } = useMsal();
  const accountId = accounts?.[0]?.homeAccountId || "anon";
  const RECEIPTS_KEY = `hub.notifications.receipts.${accountId}`;

  // Chakra defaults (theme aware)
  const textDefault = useColorModeValue("navy.700", "white");
  const menuBgDefault = useColorModeValue("white", "navy.700");
  const shadowDefault = useColorModeValue(
    "14px 17px 40px 4px rgba(112, 144, 176, 0.08)",
    "unset"
  );

  // Allow parent to override via props, otherwise use internal state
  const [internalNotifications, setInternalNotifications] = useState([]);
  const [internalReceipts, setInternalReceipts] = useState({});

  const resolvedText = props.textColor ?? textDefault;
  const resolvedMenuBg = props.menuBg ?? menuBgDefault;
  const resolvedShadow = props.shadow ?? shadowDefault;

  const loadFromStorage = useCallback(() => {
    // Load notifications
    try {
      const raw = localStorage.getItem(ADMIN_LS_KEY);
      const all = raw ? JSON.parse(raw) : [];
      const published = Array.isArray(all)
        ? all
            .filter(
              (n) => (n.status || "").toString().toLowerCase() === "published"
            )
            .sort(
              (a, b) =>
                new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            )
            .slice(0, 10)
        : [];
      setInternalNotifications(published);
    } catch (e) {
      console.warn("Kunde inte läsa admin-notiser:", e);
      setInternalNotifications([]);
    }

    // Load receipts
    try {
      const r = localStorage.getItem(RECEIPTS_KEY);
      setInternalReceipts(r ? JSON.parse(r) : {});
    } catch (e) {
      console.warn("Kunde inte läsa read receipts:", e);
      setInternalReceipts({});
    }
  }, [RECEIPTS_KEY]);

  // Initial + event sync
  useEffect(() => {
    loadFromStorage();
    const onStorage = (e) => {
      if (e.key === ADMIN_LS_KEY || e.key === RECEIPTS_KEY) loadFromStorage();
    };
    const onCustom = () => loadFromStorage();
    window.addEventListener("storage", onStorage);
    window.addEventListener("hub-notifications-updated", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("hub-notifications-updated", onCustom);
    };
  }, [loadFromStorage, RECEIPTS_KEY]);

  // Persist receipts when they change (only internal path)
  useEffect(() => {
    try {
      localStorage.setItem(RECEIPTS_KEY, JSON.stringify(internalReceipts));
    } catch (e) {
      console.warn("Kunde inte spara read receipts:", e);
    }
  }, [RECEIPTS_KEY, internalReceipts]);

  // Decide data source (parent props or internal)
  const notifications = props.notifications?.length
    ? props.notifications
    : internalNotifications;
  const receipts =
    props.receipts && Object.keys(props.receipts).length
      ? props.receipts
      : internalReceipts;

  const unreadCount = useMemo(
    () => notifications.filter((n) => !receipts[n.id]).length,
    [notifications, receipts]
  );

  const markAllRead = () => {
    if (typeof props.onMarkAllRead === "function") return props.onMarkAllRead();
    setInternalReceipts((prev) => {
      const next = { ...prev };
      notifications.forEach((n) => (next[n.id] = true));
      return next;
    });
  };

  const toggleRead = (id) => {
    if (typeof props.onToggleRead === "function") return props.onToggleRead(id);
    setInternalReceipts((prev) => ({ ...prev, [id]: prev[id] ? undefined : true }));
  };

  return (
    <Menu placement="bottom-end">
      <Box position="relative" me="10px">
        {/* Make MenuButton transparent and host our own IconButton to avoid outer halo */}
        <MenuButton
          as={Box}
          p="0"
          m="0"
          bg="transparent"
          _hover={{ bg: "transparent" }}
          _active={{ bg: "transparent" }}
          _focus={{ boxShadow: "none", bg: "transparent" }}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          onClick={loadFromStorage}
        >
          <IconButton
            aria-label="Notiser"
            icon={<Icon as={MdNotificationsNone} boxSize="20px" />}
            w="44px"
            h="44px"
            minW="44px"
            p="0"
            borderRadius="full"
            bg="white"
            _hover={{ bg: "white", transform: "translateY(-1px)" }}
            _active={{ bg: "white" }}
            _focus={{ boxShadow: "none", bg: "white" }}
            color={props.textColor ?? textDefault}
          />
        </MenuButton>

        {unreadCount > 0 && (
          <Box
            as="span"
            position="absolute"
            top="2px"
            right="2px"
            bg="red.500"
            color="white"
            borderRadius="full"
            fontSize="10px"
            lineHeight="14px"
            minW="16px"
            h="16px"
            textAlign="center"
            px="4px"
            pointerEvents="none"
          >
            {unreadCount}
          </Box>
        )}
      </Box>

      <MenuList
        boxShadow={props.shadow ?? shadowDefault}
        p="20px"
        borderRadius="20px"
        bg={props.menuBg ?? menuBgDefault}
        border="none"
        mt="22px"
        me={{ base: "30px", md: "unset" }}
        minW={{ base: "unset", md: "400px", xl: "450px" }}
        maxW={{ base: "360px", md: "unset" }}
      >
        <Flex w="100%" mb="20px" align="center">
          <Text fontSize="md" fontWeight="600" color={props.textColor ?? textDefault}>
            Notiser
          </Text>
          <Box
            as="button"
            fontSize="sm"
            fontWeight="500"
            color={useColorModeValue("gray.500", "gray.300")}
            bg={useColorModeValue("gray.100", "whiteAlpha.200")}
            px="12px"
            py="4px"
            borderRadius="full"
            _hover={{ bg: useColorModeValue("gray.200", "whiteAlpha.300") }}
            onClick={markAllRead}
            ms="auto"
          >
            Markera alla som lästa
          </Box>
        </Flex>

        <Flex flexDirection="column">
          {notifications.length === 0 && (
            <Text color={props.textColor ?? textDefault} fontSize="sm">
              Inga publicerade notiser.
            </Text>
          )}

          {notifications.map((n) => {
            const isRead = !!receipts[n.id];
            return (
              <MenuItem
                key={n.id}
                _hover={{ bg: "none" }}
                _focus={{ bg: "none" }}
                px="0"
                borderRadius="8px"
                mb="10px"
                color={isRead ? "gray.500" : props.textColor ?? textDefault}
                onClick={() => toggleRead(n.id)}
              >
                <Flex direction="column" w="100%">
                  <Text fontWeight="600" noOfLines={1}>
                    {n.title || (n.message ? n.message.substring(0, 80) : "Notis")}
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
  );
}