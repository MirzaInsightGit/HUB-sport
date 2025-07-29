import React from "react";

// Chakra imports
import { Flex } from "@chakra-ui/react";

// Custom components
import HorizonLogo from "assets/img/Stockholm-BDF-Gra-Liggande-2.png";
import { HSeparator } from "components/separator/Separator";

export function SidebarBrand() {
  

  return (
    <Flex align='center' direction='column'>
      <img src={HorizonLogo} alt="Stockholm Basket Logo" style={{ height: '30px', width: '150px', margin: '32px 0' }} />
      <HSeparator mb='20px' />
    </Flex>
  );
}

export default SidebarBrand;