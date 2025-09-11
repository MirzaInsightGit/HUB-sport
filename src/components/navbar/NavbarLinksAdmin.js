// Admin notifications dropdown (Navbar right side)

import React from "react";
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

/**
 * Props (all optional, safe defaults provided):
 * - notifications: Array<{id:string,title?:string,message?:string}>
 * - receipts: Record<id, true>  (read map)
 * - onToggleRead(id)
 * - onMarkAllRead()
 * - shadow, menuBg, textColor: style overrides
 */
export default function AdminNavbarLinks(props) {
  const {
    notifications = [],
    receipts = {},
    onToggleRead,
    onMarkAllRead,
    shadow,
    menuBg,
    textColor,
  } = props || {};

  const textDefault = useColorModeValue("navy.700", "white");
  const menuBgDefault = useColorModeValue("white", "navy.700");
  const shadowDefault = useColorModeValue("14px 17px 40px 4px rgba(112, 144, 176, 0.08)", "unset");

  const resolvedText = textColor ?? textDefault;
  const resolvedMenuBg = menuBg ?? menuBgDefault;
  const resolvedShadow = shadow ?? shadowDefault;

  const unreadCount = notifications.filter((n) => !receipts[n.id]).length;

  const markAllRead = () => {
    if (typeof onMarkAllRead === "function") onMarkAllRead();
  };
  const toggleRead = (id) => {
    if (typeof onToggleRead === "function") onToggleRead(id);
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
            color={resolvedText}
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
        boxShadow={resolvedShadow}
        p="20px"
        borderRadius="20px"
        bg={resolvedMenuBg}
        border="none"
        mt="22px"
        me={{ base: "30px", md: "unset" }}
        minW={{ base: "unset", md: "400px", xl: "450px" }}
        maxW={{ base: "360px", md: "unset" }}
      >
        <Flex w="100%" mb="20px" align="center">
          <Text fontSize="md" fontWeight="600" color={resolvedText}>
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
            <Text color={resolvedText} fontSize="sm">
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
                color={isRead ? "gray.500" : resolvedText}
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