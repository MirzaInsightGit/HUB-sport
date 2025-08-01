import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";

const useAuth = () => {
  const { instance, accounts } = useMsal();
  const [user, setUser] = useState({ role: "user" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getAuthData = async () => {
      if (accounts.length > 0) {
        try {
          const response = await instance.acquireTokenSilent({ scopes: ["User.Read"], account: accounts[0] });
          const roles = response.idTokenClaims?.roles || [];
          setUser({ role: roles[0] || "user", idToken: response.idToken, roles });
        } catch (e) {
          console.error("Token error:", e);
          await instance.acquireTokenPopup({ scopes: ["User.Read"] });
        }
      }
      setIsLoading(false);
    };
    getAuthData();
  }, [instance, accounts]);

  return { user, isAuthenticated: accounts.length > 0, isLoading };
};

export default useAuth;