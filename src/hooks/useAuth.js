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
          const claims = response.idTokenClaims || {};
          const roles  = Array.isArray(claims.roles)  ? claims.roles.map(r => String(r).toLowerCase()) : [];
          const groups = Array.isArray(claims.groups) ? claims.groups : [];
          const email  = claims.preferred_username || claims.upn || accounts[0]?.username;

          if (process.env.NODE_ENV !== "production") {
            // Hjälpsam debug i dev-miljö
            // eslint-disable-next-line no-console
            console.debug("[useAuth] idTokenClaims:", claims);
          }

          setUser({
            role: roles[0] || "user",
            idToken: response.idToken,
            roles,
            groups,
            email,
          });
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