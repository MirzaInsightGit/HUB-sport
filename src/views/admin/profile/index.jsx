import React, { useState, useEffect } from "react";
import {
  Box,
  Text,
  VStack,
} from "@chakra-ui/react";
import Card from "components/card/Card.js";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
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
          authProvider: {
            getAccessToken: () => Promise.resolve(tokenResponse.accessToken),
          },
        });
        const user = await graphClient.api("/me").get();
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
    <Box pt={{ base: "130px", md: "80px", xl: "80px" }}>
      {isLoading && <Text>Laddar profil...</Text>}
      {error && <Text>Fel: {error}</Text>}
      <Card mt="20px">
        <Text fontSize="2xl" fontWeight="700">Profilinställningar</Text>
        <VStack spacing="4" align="stretch" mt="4">
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
        </VStack>
      </Card>
    </Box>
  );
}