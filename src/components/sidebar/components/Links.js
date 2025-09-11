/* eslint-disable */
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
// chakra imports
import { Box, Flex, Text, Tooltip, useColorModeValue } from "@chakra-ui/react";
import useAuth from "hooks/useAuth";

export function SidebarLinks(props) {
  const { routes, collapsed = false } = props;
  //   Chakra color mode
  let location = useLocation();
  let activeColor = useColorModeValue("gray.700", "white");
  let inactiveColor = useColorModeValue(
    "secondaryGray.600",
    "secondaryGray.600"
  );
  const activeIconColor = useColorModeValue('brand.500', 'white');
  const inactiveIconColor = useColorModeValue('gray.500', 'gray.300');
  const hoverBg = 'blackAlpha.200';

  const itemGap = 3;
  const itemY = 1;
  const iconSize = '20px';

  const AUTH_MODE = process.env.REACT_APP_AUTH_MODE || 'default';
  const { user } = useAuth();
  const roles  = user?.roles  ?? [];
  const groups = user?.groups ?? [];

  const ADMIN_GROUP_IDS = (process.env.REACT_APP_ADMIN_GROUP_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const COACH_GROUP_IDS = (process.env.REACT_APP_COACH_GROUP_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const hasGroup = (ids) => ids.length > 0 && ids.some((id) => groups.includes(id));
  const hasRole  = (name) => roles.includes(String(name).toLowerCase());

  const allowedBy = (allow) => {
    const a = (allow && allow.length ? allow : ['admin','coach']).map(s => s.toLowerCase());
    const wantsAdmin = a.includes('admin');
    const wantsCoach = a.includes('coach');
    const adminOkByRole  = hasRole('admin');
    const coachOkByRole  = hasRole('coach');
    const adminOkByGroup = hasGroup(ADMIN_GROUP_IDS);
    const coachOkByGroup = hasGroup(COACH_GROUP_IDS);

    if (AUTH_MODE === 'strict_groups') {
      return (wantsAdmin && adminOkByGroup) || (wantsCoach && coachOkByGroup);
    }
    return (wantsAdmin && (adminOkByRole || adminOkByGroup)) ||
           (wantsCoach && (coachOkByRole || coachOkByGroup));
  };

  const filterAllowed = (arr) => (Array.isArray(arr) ? arr.filter((r) => !r?.hidden && !r?.isUtility && allowedBy(r.allow)) : []);

  // verifies if routeName is the one active (in browser input)
  const activeRoute = (routeName) => {
    return location.pathname.includes(routeName);
  };

  // this function creates the links from the secondary accordions (for example auth -> sign-in -> default)
  const createLinks = (routes) => {
    return filterAllowed(routes).map((route, index) => {
      if (route.category) {
        return (
          <React.Fragment key={`cat-${index}`}>
            {!collapsed && (
              <Text
                fontSize={"md"}
                color={activeColor}
                fontWeight='bold'
                mx='auto'
                ps={{ sm: "10px", xl: "16px" }}
                pt='18px'
                pb='12px'
              >
                {route.name}
              </Text>
            )}
            {createLinks(route.items)}
          </React.Fragment>
        );
      } else if (route.collapse) {
        return (
          <Box key={index}>
            <Tooltip label={route.name} placement="right" isDisabled={!collapsed}>
              <Flex
                as={NavLink}
                to={route.layout + route.path}
                align="center"
                justify={collapsed ? 'center' : 'flex-start'}
                gap={itemGap}
                px={collapsed ? 0 : 2}
                py={2}
                my={itemY}
                borderRadius="md"
                _hover={{ bg: hoverBg }}
                w='100%'
              >
                <Box fontSize={iconSize} color={activeRoute(route.path.toLowerCase()) ? activeIconColor : inactiveIconColor}>{route.icon}</Box>
                {!collapsed && (
                  <Text fontSize="sm" lineHeight='1' me='auto'>
                    {route.name}
                  </Text>
                )}
              </Flex>
            </Tooltip>
            {filterAllowed(route.items).map((item, subIndex) => (
              <Tooltip key={subIndex} label={item.name} placement="right" isDisabled={!collapsed}>
                <Flex
                  as={NavLink}
                  to={item.layout + item.path}
                  align="center"
                  justify={collapsed ? 'center' : 'flex-start'}
                  gap={itemGap}
                  px={collapsed ? 0 : 2}
                  py={2}
                  my={itemY}
                  borderRadius="md"
                  _hover={{ bg: hoverBg }}
                  w='100%'
                >
                  <Box fontSize={iconSize} color={activeRoute(item.path.toLowerCase()) ? activeIconColor : inactiveIconColor}>{item.icon}</Box>
                  {!collapsed && (
                    <Text fontSize="sm" lineHeight='1' me='auto'>
                      {item.name}
                    </Text>
                  )}
                </Flex>
              </Tooltip>
            ))}
          </Box>
        );
      } else if (
        route.layout === "/admin" ||
        route.layout === "/coach"
      ) {
        return (
          route.icon ? (
            <Tooltip key={index} label={route.name} placement="right" isDisabled={!collapsed}>
              <Flex
                as={NavLink}
                to={route.layout + route.path}
                align="center"
                justify={collapsed ? 'center' : 'flex-start'}
                gap={itemGap}
                px={collapsed ? 0 : 2}
                py={2}
                my={itemY}
                borderRadius="md"
                _hover={{ bg: hoverBg }}
                w='100%'
              >
                <Box fontSize={iconSize} color={activeRoute(route.path.toLowerCase()) ? activeIconColor : inactiveIconColor}>{route.icon}</Box>
                {!collapsed && (
                  <Text fontSize="sm" lineHeight='1' me='auto'>
                    {route.name}
                  </Text>
                )}
              </Flex>
            </Tooltip>
          ) : (
            <Tooltip key={index} label={route.name} placement="right" isDisabled={!collapsed}>
              <Flex
                as={NavLink}
                to={route.layout + route.path}
                align="center"
                justify={collapsed ? 'center' : 'flex-start'}
                gap={itemGap}
                px={collapsed ? 0 : 2}
                py={2}
                my={itemY}
                borderRadius="md"
                _hover={{ bg: hoverBg }}
                w='100%'
              >
                {!collapsed && (
                  <Text fontSize="sm" lineHeight='1' me='auto'>
                    {route.name}
                  </Text>
                )}
              </Flex>
            </Tooltip>
          )
        );
      }
    });
  };
  //  BRAND
  return createLinks(routes);
}

export default SidebarLinks;