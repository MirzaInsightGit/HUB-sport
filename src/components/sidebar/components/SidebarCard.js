import { Flex, Link, Text } from "@chakra-ui/react";
import React from "react";

export default function SidebarDocs() {
  return (
    <Flex justify="center" align="center" direction="column" py={4}>
      <Link href="mailto:mirza.muhic@stockholmbasket.se" _hover={{ textDecoration: "none" }}>
        <Flex
          bg="blue"
          color="white"
          px={4}
          py={2}
          borderRadius="md"
          justify="center"
          align="center"
          _hover={{ bg: "gray.700" }}
          cursor="pointer"
        >
          <Text fontSize="md" fontWeight="semibold">
            Kontakta Support
          </Text>
        </Flex>
      </Link>
    </Flex>
  );
}