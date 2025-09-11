// src/views/admin/settings/Settings.jsx
import React from "react";
import {
  Box, Flex, Heading, Text, Tabs, TabList, TabPanels, Tab, TabPanel,
  SimpleGrid, Card, CardHeader, CardBody, Button, Switch, FormControl, FormLabel, Input
} from "@chakra-ui/react";
import NotificationsAdmin from "views/admin/notifications/NotificationsAdmin";

export default function Settings() {
  return (
    <Box>
      <Heading size="lg" mb={2}>Settings</Heading>
      <Text fontSize="sm" color="gray.500" mb={6}>
        Administrera portalens inställningar.
      </Text>

      <Tabs variant="soft-rounded" colorScheme="blue">
        <TabList>
          <Tab>Företag</Tab>
          <Tab>Branding </Tab>
          <Tab>Aviseringar för Admin</Tab>
          <Tab>Integrationer för Admin</Tab>
        </TabList>

        <TabPanels mt={4}>
          {/* Företag */}
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
              <Card>
                <CardHeader fontWeight="bold">Företagsinformation</CardHeader>
                <CardBody>
                  <FormControl mb={4}>
                    <FormLabel>Företagsnamn</FormLabel>
                    <Input placeholder="Stockholms Basketbollförbund" />
                  </FormControl>
                  <FormControl mb={4}>
                    <FormLabel>Organisationsnummer</FormLabel>
                    <Input placeholder="556xxx-xxxx" />
                  </FormControl>
                  <Button colorScheme="blue">Spara</Button>
                </CardBody>
              </Card>

              <Card>
                <CardHeader fontWeight="bold">Språk & Tid</CardHeader>
                <CardBody>
                  <FormControl display="flex" alignItems="center" mb={4}>
                    <FormLabel mb="0">Svenska som standardspråk</FormLabel>
                    <Switch defaultChecked />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Tidszon</FormLabel>
                    <Input placeholder="Europe/Stockholm" />
                  </FormControl>
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          {/* Branding */}
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
              <Card>
                <CardHeader fontWeight="bold">Logotyp</CardHeader>
                <CardBody>
                  <Button variant="outline">Ladda upp logotyp</Button>
                </CardBody>
              </Card>
              <Card>
                <CardHeader fontWeight="bold">Färger</CardHeader>
                <CardBody>
                  <FormControl mb={4}>
                    <FormLabel>Primär färg</FormLabel>
                    <Input placeholder="#2B6CB0" />
                  </FormControl>
                  <Button colorScheme="blue">Spara</Button>
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          {/* Aviseringar */}
          <TabPanel>
            <NotificationsAdmin />
          </TabPanel>

          {/* Integrationer */}
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
              <Card>
                <CardHeader fontWeight="bold">Profixio</CardHeader>
                <CardBody>
                  <Button variant="outline">Koppla/konfigurera</Button>
                </CardBody>
              </Card>
              <Card>
                <CardHeader fontWeight="bold">WooCommerce</CardHeader>
                <CardBody>
                  <Button variant="outline">Koppla/konfigurera</Button>
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}