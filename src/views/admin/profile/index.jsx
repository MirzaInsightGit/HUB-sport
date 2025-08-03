import React, { useState, useEffect } from "react";
import {
  Box, Text, VStack, HStack, Avatar, Tabs, TabList, TabPanels, Tab, TabPanel,
  FormControl, FormLabel, Input, Button, Stat, StatLabel, StatNumber,
} from "@chakra-ui/react";
import Card from "components/card/Card.js";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { Client } from "@microsoft/microsoft-graph-client";
import { loginRequest } from "authConfig";

export default function UserReports() {
  const { instance, accounts } = useMsal();
  const [profileData, setProfileData] = useState({
    displayName: accounts[0]?.name || "User",
    givenName: "",
    surname: "",
    userPrincipalName: accounts[0]?.username || "",
    id: "",
    userType: "",
    createdDateTime: "",
    jobTitle: "",
    companyName: "",
    department: "",
    employeeId: "",
    employeeType: "",
    employeeHireDate: "",
    officeLocation: "",
    streetAddress: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    businessPhones: [],
    mobilePhone: "",
    mail: accounts[0]?.idTokenClaims?.emails?.[0] || "",
    faxNumber: "",
    preferredLanguage: "",
    accountEnabled: true,
    managerName: "",
    photoUrl: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!accounts.length) return;
      try {
        setIsLoading(true);
        setError(null);
        const tokenResponse = await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
        const graphClient = Client.init({
          authProvider: (done) => {
            done(null, tokenResponse.accessToken);
          },
        });
        const selectProps = 'displayName,givenName,surname,userPrincipalName,id,userType,createdDateTime,jobTitle,companyName,department,employeeId,employeeType,employeeHireDate,officeLocation,streetAddress,city,state,postalCode,country,businessPhones,mobilePhone,mail,facsimileTelephoneNumber,preferredLanguage,accountEnabled';
        const user = await graphClient.api("/me").select(selectProps).get();
        
        let managerName = "N/A";
        try {
          const manager = await graphClient.api("/me/manager").get();
          managerName = manager?.displayName || "N/A";
        } catch (managerError) {
          console.error("Manager fetch error:", managerError);
        }
        
        let photoUrl = "";
        try {
          const photoResponse = await graphClient.api("/me/photo/$value").get();
          photoUrl = URL.createObjectURL(photoResponse);
        } catch (photoError) {
          console.error("Photo fetch error:", photoError);
        }
        
        setProfileData((prev) => ({
          ...prev,
          displayName: user.displayName || prev.displayName,
          givenName: user.givenName || "",
          surname: user.surname || "",
          userPrincipalName: user.userPrincipalName || prev.userPrincipalName,
          id: user.id || "",
          userType: user.userType || "",
          createdDateTime: user.createdDateTime || "",
          jobTitle: user.jobTitle || "",
          companyName: user.companyName || "",
          department: user.department || "",
          employeeId: user.employeeId || "",
          employeeType: user.employeeType || "",
          employeeHireDate: user.employeeHireDate || "",
          officeLocation: user.officeLocation || "",
          streetAddress: user.streetAddress || "",
          city: user.city || "",
          state: user.state || "",
          postalCode: user.postalCode || "",
          country: user.country || "",
          businessPhones: user.businessPhones || [],
          mobilePhone: user.mobilePhone || "",
          mail: user.mail || prev.mail,
          faxNumber: user.facsimileTelephoneNumber || "",
          preferredLanguage: user.preferredLanguage || "",
          accountEnabled: user.accountEnabled,
          managerName: managerName,
          photoUrl: photoUrl,
        }));
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          await instance.acquireTokenPopup({ ...loginRequest, account: accounts[0] });
          fetchProfile();
        } else {
          setError(error.message);
          console.error(error);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [instance, accounts]);

  return (
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }} bg="gray.50">
      {isLoading && <Text>Laddar profil...</Text>}
      {error && <Text color="red.500">Fel: {error}</Text>}
      <Card mt="20px" boxShadow="lg" borderRadius="lg" overflow="hidden">
       
        {/* Profile Header */}
        <HStack spacing="4" px="6" pt="6" align="flex-start">
          <Avatar size="2xl" name={profileData.displayName} src={profileData.photoUrl} border="4px solid white" />
          <VStack align="start" spacing="1">
            <Text fontSize="2xl" fontWeight="bold">{profileData.displayName}</Text>
            <Text color="gray.500">{profileData.jobTitle}</Text>
            <Text color="gray.500">Manager: {profileData.managerName}</Text>
          </VStack>
        </HStack>
        {/* Stats */}
        <HStack px="6" mt="4" spacing="8">
          <Stat>
            <StatLabel>Skapad</StatLabel>
            <StatNumber>{profileData.createdDateTime}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Anställd ID</StatLabel>
            <StatNumber>{profileData.employeeId || "N/A"}</StatNumber>
          </Stat>
        </HStack>
        {/* Tabs */}
        <Tabs mt="6" variant="enclosed">
          <TabList>
            <Tab>Kontoinställningar</Tab>
            <Tab>Företagsinställningar</Tab>
            <Tab>Notiser</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <VStack spacing="4" align="stretch">
                <HStack spacing="4">
                  <FormControl>
                    <FormLabel>Förnamn</FormLabel>
                    <Input value={profileData.givenName} isReadOnly />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Efternamn</FormLabel>
                    <Input value={profileData.surname} isReadOnly />
                  </FormControl>
                </HStack>
                <FormControl>
                  <FormLabel>E-post</FormLabel>
                  <Input value={profileData.mail} isReadOnly />
                </FormControl>
                <FormControl>
                  <FormLabel>Telefon</FormLabel>
                  <Input value={profileData.mobilePhone || profileData.businessPhones[0]} isReadOnly />
                </FormControl>
                <FormControl>
                  <FormLabel>Gatuadress</FormLabel>
                  <Input value={profileData.streetAddress} isReadOnly />
                </FormControl>
                <HStack spacing="4">
                  <FormControl>
                    <FormLabel>Stad</FormLabel>
                    <Input value={profileData.city} isReadOnly />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Delstat/Provins</FormLabel>
                    <Input value={profileData.state} isReadOnly />
                  </FormControl>
                </HStack>
                <HStack spacing="4">
                  <FormControl>
                    <FormLabel>Postnummer</FormLabel>
                    <Input value={profileData.postalCode} isReadOnly />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Land</FormLabel>
                    <Input value={profileData.country} isReadOnly />
                  </FormControl>
                </HStack>
              </VStack>
            </TabPanel>
            <TabPanel>
              <VStack spacing="4" align="stretch">
                <FormControl>
                  <FormLabel>Företagsnamn</FormLabel>
                  <Input value={profileData.companyName} isReadOnly />
                </FormControl>
                <FormControl>
                  <FormLabel>Avdelning</FormLabel>
                  <Input value={profileData.department} isReadOnly />
                </FormControl>
                <FormControl>
                  <FormLabel>Kontor</FormLabel>
                  <Input value={profileData.officeLocation} isReadOnly />
                </FormControl>
                <FormControl>
                  <FormLabel>Anställningstyp</FormLabel>
                  <Input value={profileData.employeeType} isReadOnly />
                </FormControl>
                <FormControl>
                  <FormLabel>Anställningsdatum</FormLabel>
                  <Input value={profileData.employeeHireDate} isReadOnly />
                </FormControl>
              </VStack>
            </TabPanel>
            <TabPanel>
              <Text>Notiser-inställningar (implementera senare)</Text>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Card>
    </Box>
  );
}