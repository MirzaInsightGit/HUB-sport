import React, { useState, useEffect } from "react";

// chakra imports
import {
  Box,
  Flex,
  Drawer,
  DrawerBody,
  Icon,
  useColorModeValue,
  DrawerOverlay,
  useDisclosure,
  DrawerContent,
  DrawerCloseButton,
  IconButton,
  Tooltip,
  Text,
} from "@chakra-ui/react";
import Content from "components/sidebar/components/Content";
import {
  renderThumb,
  renderTrack,
  renderView,
} from "components/scrollbar/Scrollbar";
import { Scrollbars } from "react-custom-scrollbars-2";
import PropTypes from "prop-types";

// Assets
import { IoMenuOutline } from "react-icons/io5";
import { MdChevronLeft, MdChevronRight, MdSettings, MdPerson, MdHelpOutline } from "react-icons/md";
import { NavLink } from "react-router-dom";

function Sidebar(props) {
  const { routes } = props;
  const filteredRoutes = routes.filter(route => !route.hidden); // Filtrera dolda

  const [collapsed, setCollapsed] = useState(true);
  // Force collapsed on first mount, then persist user toggles
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', '1');
  }, []);
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  let variantChange = "0.2s linear";
  let shadow = useColorModeValue(
    "14px 17px 40px 4px rgba(112, 144, 176, 0.08)",
    "unset"
  );
  // Chakra Color Mode
  let sidebarBg = useColorModeValue("white", "navy.800");
  let sidebarMargins = "0px";

  // SIDEBAR
  return (
    <Box display={{ sm: "none", xl: "block" }} w="100%" position='fixed' minH='100%'>
      <Box
        bg={sidebarBg}
        transition={variantChange}
        w={collapsed ? '72px' : '300px'}
        h='100vh'
        m={sidebarMargins}
        minH='100%'
        overflowX='hidden'
        overflow='hidden'
        display='flex'
        flexDirection='column'
        boxShadow={shadow}>
        {/* TOGGLE REMOVED -- Add back here if needed */}
        <Box flex='1' overflow='hidden'>
          <Scrollbars
            autoHide
            renderTrackVertical={renderTrack}
            renderThumbVertical={renderThumb}
            renderView={renderView}>
            <Content routes={filteredRoutes} collapsed={collapsed} /> {/* Använd filtrerad */}
          </Scrollbars>
        </Box>
        <Flex direction="column" mt="auto" px={collapsed ? 0 : 2} py={3} gap={2}>
          <Tooltip label="Inställningar" placement="right" isDisabled={!collapsed}>
            <Flex as={NavLink} to="/admin/settings" align="center" justify={collapsed ? 'center' : 'flex-start'} gap={3} px={collapsed ? 0 : 2} py={2} borderRadius="md" _hover={{ bg: 'blackAlpha.200' }}>
              <MdSettings />
              {!collapsed && <Text fontSize="sm">Inställningar</Text>}
            </Flex>
          </Tooltip>
          <Tooltip label="Mitt konto" placement="right" isDisabled={!collapsed}>
            <Flex as={NavLink} to="/admin/profile" align="center" justify={collapsed ? 'center' : 'flex-start'} gap={3} px={collapsed ? 0 : 2} py={2} borderRadius="md" _hover={{ bg: 'blackAlpha.200' }}>
              <MdPerson />
              {!collapsed && <Text fontSize="sm">Mitt konto</Text>}
            </Flex>
          </Tooltip>
          <Tooltip label="Hjälp" placement="right" isDisabled={!collapsed}>
            <Flex as={NavLink} to="/admin/help" align="center" justify={collapsed ? 'center' : 'flex-start'} gap={3} px={collapsed ? 0 : 2} py={2} borderRadius="md" _hover={{ bg: 'blackAlpha.200' }}>
              <MdHelpOutline />
              {!collapsed && <Text fontSize="sm">Hjälp</Text>}
            </Flex>
          </Tooltip>
        </Flex>
      </Box>
    </Box>
  );
}

// FUNCTIONS
export function SidebarResponsive(props) {
  let sidebarBackgroundColor = useColorModeValue("white", "navy.800");
  let menuColor = useColorModeValue("gray.400", "white");
  // // SIDEBAR
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = React.useRef();

  const { routes } = props;
  const filteredRoutes = routes.filter(route => !route.hidden); // Filtrera dolda

  return (
    <Flex display={{ sm: "flex", xl: "none" }} alignItems='center'>
      <Flex ref={btnRef} w='max-content' h='max-content' onClick={onOpen}>
        <Icon
          as={IoMenuOutline}
          color={menuColor}
          my='auto'
          w='20px'
          h='20px'
          me='10px'
          _hover={{ cursor: "pointer" }}
        />
      </Flex>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        placement={document.documentElement.dir === "rtl" ? "right" : "left"}
        finalFocusRef={btnRef}>
        <DrawerOverlay />
        <DrawerContent w='285px' maxW='285px' bg={sidebarBackgroundColor}>
          <DrawerCloseButton
            zIndex='3'
            onClose={onClose}
            _focus={{ boxShadow: "none" }}
            _hover={{ boxShadow: "none" }}
          />
          <DrawerBody maxW='285px' px='0rem' pb='0'>
            <Scrollbars
              autoHide
              renderTrackVertical={renderTrack}
              renderThumbVertical={renderThumb}
              renderView={renderView}>
              <Content routes={filteredRoutes} /> {/* Använd filtrerad */}
            </Scrollbars>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
}
// PROPS

Sidebar.propTypes = {
  logoText: PropTypes.string,
  routes: PropTypes.arrayOf(PropTypes.object),
  variant: PropTypes.string,
};

export default Sidebar;