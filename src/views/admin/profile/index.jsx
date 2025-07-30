import React, { useState, useEffect } from "react";
import {
  Box,
  SimpleGrid,
  Text,
  Input,
  Button,
  FormControl,
  FormLabel,
  Avatar,
  Flex,
  useColorModeValue,
  VStack,
} from "@chakra-ui/react";
import Card from "components/card/Card.js";
import Banner from "views/admin/profile/components/Banner";
import Projects from "views/admin/profile/components/Projects";
import Storage from "views/admin/profile/components/Storage";
import Upload from "views/admin/profile/components/Upload";
import Notifications from "views/admin/profile/components/Notifications";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
import { loginRequest } from "authConfig"; // Uppdatera scopes: ['User.Read', 'User.ReadWrite.All']

import banner from 'assets/img/auth/banner.png';
import avatar from 'assets/img/avatars/avatar4.png';

export default function UserReports() {
  const { instance, accounts } = useMsal();
  const textColor = useColorModeValue("navy.700", "white");
  const textColorBrand = useColorModeValue("brand.500", "white");
  const [profileData, setProfileData] = useState({
    displayName: "",
    givenName: "",
    surname: "",
    userPrincipalName: "",
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
    mail: "",
    faxNumber: "",
    preferredLanguage: "",
    accountEnabled: true,
  });
  const [isEditing, setIsEditing] = useState(false);
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
          authProvider: { getAccessToken: () => tokenResponse.accessToken },
        });
        const user = await graphClient.api("/me").get();
        setProfileData({
          displayName: user.displayName || "",
          givenName: user.givenName || "",
          surname: user.surname || "",
          userPrincipalName: user.userPrincipalName || "",
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
          mail: user.mail || "",
          faxNumber: user.facsimileTelephoneNumber || "",
          preferredLanguage: user.preferredLanguage || "",
          accountEnabled: user.accountEnabled,
        });
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const updateProfile = async () => {
    try {
      const tokenResponse = await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
      const graphClient = Client.init({
        authProvider: { getAccessToken: () => tokenResponse.accessToken },
      });
      await graphClient.api("/me").patch({
        displayName: profileData.displayName,
        givenName: profileData.givenName,
        surname: profileData.surname,
        jobTitle: profileData.jobTitle,
        companyName: profileData.companyName,
        department: profileData.department,
        employeeId: profileData.employeeId,
        employeeType: profileData.employeeType,
        employeeHireDate: profileData.employeeHireDate,
        officeLocation: profileData.officeLocation,
        streetAddress: profileData.streetAddress,
        city: profileData.city,
        state: profileData.state,
        postalCode: profileData.postalCode,
        country: profileData.country,
        businessPhones: profileData.businessPhones,
        mobilePhone: profileData.mobilePhone,
        faxNumber: profileData.faxNumber,
        preferredLanguage: profileData.preferredLanguage,
      });
      setIsEditing(false);
      alert("Profil uppdaterad!");
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) return <Text>Laddar profil...</Text>;
  if (error) return <Text>Fel: {error}</Text>;

  return (
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }}>
      <SimpleGrid mb="20px" columns={{ sm: 1, md: 2 }} spacing={{ base: "20px", xl: "20px" }}>
        <Flex flexDirection="column" gridArea={{ xl: "1 / 1 / 2 / 3", "2xl": "1 / 1 / 2 / 2" }}>
          <Banner
            gridArea="1 / 1 / 2 / 2"
            banner={banner}
            avatar={avatar}
            name={profileData.displayName}
            job={profileData.jobTitle}
            posts="17"
            followers="9.7k"
            following="274"
          />
          <Storage gridArea={{ base: "2 / 1 / 3 / 2", xl: "1 / 2 / 2 / 3" }} used={25.6} total={50} />
        </Flex>
        <Flex flexDirection="column" gridArea={{ xl: "1 / 3 / 2 / 4", "2xl": "1 / 2 / 2 / 3" }}>
          <Card px="0px" mb="20px">
            <Notifications used={{ used: 59.0, total: 50 }} newTabs={true} />
          </Card>
          <Card p="0px">
            <Flex
              align={{ sm: "flex-start", lg: "center" }}
              direction={{ sm: "column", lg: "row" }}
              w="100%"
              px="22px"
              py="18px"
            >
              <Text color={textColor} fontSize="xl" fontWeight="600">
                Ladda upp filer
              </Text>
              <Flex align="center" ms={{ sm: "8px", lg: "auto" }} mt={{ sm: "8px", lg: "0px" }}>
                <FormLabel
                  ms="0px"
                  htmlFor="file-uploader"
                  cursor="pointer"
                  minH="32px"
                  fontSize="sm"
                  fontWeight="500"
                  _hover={{ color: "brand.600" }}
                  color={textColorBrand}
                >
                  Ladda upp filer
                </FormLabel>
                <Input id="file-uploader" type="file" onChange={() => {}} display="none" />
              </Flex>
            </Flex>
            <Upload minH={{ base: "auto", "2xl": "420px", "3xl": "auto" }} pe="20px" pb={{ base: "100px", lg: "20px" }} />
          </Card>
        </Flex>
      </SimpleGrid>
      <SimpleGrid columns={{ sm: 1, md: 2 }} spacing={{ base: "20px", xl: "20px" }}>
        <Projects
          gridArea="1 / 2 / 2 / 3"
          banner={banner}
          avatar={avatar}
          name={profileData.displayName}
          job={profileData.jobTitle}
          posts="17"
          followers="9.7k"
          following="274"
        />
      </SimpleGrid>
      <Card mt="20px">
        <Flex justify="space-between">
          <Text fontSize="2xl" fontWeight="700">Profilinställningar</Text>
          <Button onClick={() => setIsEditing(!isEditing)}>{isEditing ? "Avbryt" : "Redigera"}</Button>
        </Flex>
        <VStack spacing="4" align="stretch" mt="4">
          {isEditing ? (
            <>
              <FormControl>
                <FormLabel>Display name</FormLabel>
                <Input name="displayName" value={profileData.displayName} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>First name</FormLabel>
                <Input name="givenName" value={profileData.givenName} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Last name</FormLabel>
                <Input name="surname" value={profileData.surname} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>User principal name</FormLabel>
                <Input name="userPrincipalName" value={profileData.userPrincipalName} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Job title</FormLabel>
                <Input name="jobTitle" value={profileData.jobTitle} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Company name</FormLabel>
                <Input name="companyName" value={profileData.companyName} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Department</FormLabel>
                <Input name="department" value={profileData.department} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Employee ID</FormLabel>
                <Input name="employeeId" value={profileData.employeeId} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Employee type</FormLabel>
                <Input name="employeeType" value={profileData.employeeType} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Employee hire date</FormLabel>
                <Input name="employeeHireDate" value={profileData.employeeHireDate} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Office location</FormLabel>
                <Input name="officeLocation" value={profileData.officeLocation} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Street address</FormLabel>
                <Input name="streetAddress" value={profileData.streetAddress} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>City</FormLabel>
                <Input name="city" value={profileData.city} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>State or province</FormLabel>
                <Input name="state" value={profileData.state} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>ZIP or postal code</FormLabel>
                <Input name="postalCode" value={profileData.postalCode} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Country or region</FormLabel>
                <Input name="country" value={profileData.country} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Business phone</FormLabel>
                <Input name="businessPhones" value={profileData.businessPhones.join(', ')} onChange={(e) => setProfileData((prev) => ({ ...prev, businessPhones: e.target.value.split(', ') }))} />
              </FormControl>
              <FormControl>
                <FormLabel>Mobile phone</FormLabel>
                <Input name="mobilePhone" value={profileData.mobilePhone} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Fax number</FormLabel>
                <Input name="faxNumber" value={profileData.faxNumber} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <FormLabel>Preferred language</FormLabel>
                <Input name="preferredLanguage" value={profileData.preferredLanguage} onChange={handleChange} />
              </FormControl>
              <Button mt="4" onClick={updateProfile}>Spara</Button>
            </>
          ) : (
            <>
              <Text>Display name: {profileData.displayName}</Text>
              <Text>First name: {profileData.givenName}</Text>
              <Text>Last name: {profileData.surname}</Text>
              <Text>User principal name: {profileData.userPrincipalName}</Text>
              <Text>Object ID: {profileData.id}</Text>
              <Text>User type: {profileData.userType}</Text>
              <Text>Created date time: {profileData.createdDateTime}</Text>
              <Text>Job title: {profileData.jobTitle}</Text>
              <Text>Company name: {profileData.companyName}</Text>
              <Text>Department: {profileData.department}</Text>
              <Text>Employee ID: {profileData.employeeId}</Text>
              <Text>Employee type: {profileData.employeeType}</Text>
              <Text>Employee hire date: {profileData.employeeHireDate}</Text>
              <Text>Office location: {profileData.officeLocation}</Text>
              <Text>Street address: {profileData.streetAddress}</Text>
              <Text>City: {profileData.city}</Text>
              <Text>State or province: {profileData.state}</Text>
              <Text>ZIP or postal code: {profileData.postalCode}</Text>
              <Text>Country or region: {profileData.country}</Text>
              <Text>Business phone: {profileData.businessPhones.join(', ')}</Text>
              <Text>Mobile phone: {profileData.mobilePhone}</Text>
              <Text>Email: {profileData.mail}</Text>
              <Text>Fax number: {profileData.faxNumber}</Text>
              <Text>Preferred language: {profileData.preferredLanguage}</Text>
              <Text>Account enabled: {profileData.accountEnabled ? "Yes" : "No"}</Text>
            </>
          )}
        </VStack>
      </Card>
    </Box>
  );
}