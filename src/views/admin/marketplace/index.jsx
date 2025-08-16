

import React from "react";

// Chakra imports
import { Box } from "@chakra-ui/react";

import PlayerList from "../../../components/playerList/PlayerList";

export default function Marketplace() {
  return (
    <Box pt={{ base: "180px", md: "80px", xl: "80px" }}>
      <PlayerList />
    </Box>
  );
}