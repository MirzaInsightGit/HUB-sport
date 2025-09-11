import React from "react";

// Chakra imports
import { Flex } from "@chakra-ui/react";

// Custom components
import HorizonLogo from "assets/img/Stockholm-BDF-Gra-Liggande-2.png";
import { HSeparator } from "components/separator/Separator";
import { MdSportsBasketball } from "react-icons/md";

export function SidebarBrand({ collapsed }) {
  return (
    <Flex align='center' direction='column'>
      {!collapsed ? (
        <Flex align='center' justify='center' h='30px' my='32px'>
          <MdSportsBasketball size={30} />
        </Flex>
      ) : (
        <Flex align='center' justify='center' h='30px' w='72px' my='32px'>
          <MdSportsBasketball size={24} />
        </Flex>
      )}
      <HSeparator mb='20px' />
    </Flex>
  );
}

export default SidebarBrand;