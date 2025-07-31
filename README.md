# HUB Sport Portal ⚡️  
[hub.mirzamuhic.com](https://hub.mirzamuhic.com)  
Fullstack React + Azure-baserad sportplattform för distrikts- och lagadministration.

## 🔧 Projektbeskrivning

Detta projekt syftar till att skapa en komplett sportportal för Stockholm Basket och övriga användargrupper, med följande funktionalitet:

- Inloggning med Microsoft Entra (Azure AD B2C)
- Rollbaserad åtkomst (Admin, Coach, User)
- Integration mot Express API (Azure)
- Headless WooCommerce-integration (API)
- Redigering och hantering av spelardata (inkl. betyg, kommentarer, uppladdning av bilder per lägermoment)
- Synkronisering mot CosmosDB / Microsoft-ekosystemet
- Automatisk import av ordrar / anmälningar från WordPress
- Designad med Chakra UI och React, inspirerad av templates från [mantisdashboard.io](https://mantisdashboard.io) för enkel och mobilvänlig dashboard
- Komplett support för coach-vy, adminpanel, spelare och läger (inkl. DLT: Distriktslag Uttagningar med 5 läger, hantering av WooCommerce-anmälningar, betalningar till Fortnox)
- Fullt hostad i Azure Static Web App + Azure Express API
- Integration med Profixio för matchhantering, domaradministration och bokning
- Möjlighet till subdomäner för distrikt, t.ex. projektx.stockholmbasket.se
- Centraliserad plattform för kommunikation, ersätter WhatsApp/Messenger, med fokus på domare och administration

## 🌐 Domän & Deployment

- **Frontend**: [https://hub.mirzamuhic.com](https://hub.mirzamuhic.com)
- **API**: [https://stockholmbasket-express-api-avf6ayfkdnc3b6gn.centralus-01.azurewebsites.net/](https://stockholmbasket-express-api-avf6ayfkdnc3b6gn.centralus-01.azurewebsites.net/)
- **GitHub Repo**: [https://github.com/MirzaInsightGit/HUB-sport](https://github.com/MirzaInsightGit/HUB-sport)

## 📦 Tech Stack

- **Frontend**: React + Chakra UI + React Router
- **Backend**: Node.js (Express) + CosmosDB
- **Auth**: Microsoft Entra ID (via MSAL)
- **Hosting**: Azure Static Web App + Azure Functions
- **CI/CD**: GitHub Actions + Azure Pipelines (kommande)

## 🔐 Roller och säkerhet

Systemet använder Entra ID för rollstyrning, där `RequireAdminRoute`, `RequireCoachRoute` och `RequireUserRoute` säkerställer att endast behöriga användare ser rätt innehåll. Roller läses in från `idToken.claims`.


## 🚀 Installation

### 1. Klona projektet

```bash
git clone https://github.com/MirzaInsightGit/HUB-sport.git
cd HUB-sport
```

### 2. Installera beroenden

```bash
npm install
```

### 3. Miljövariabler (.env)

Skapa en .env-fil i root med följande:

```
REACT_APP_WC_URL=https://stockholmbasket.se
REACT_APP_WC_KEY=...
REACT_APP_WC_SECRET=...
REACT_APP_COSMOS_ENDPOINT=...
REACT_APP_COSMOS_KEY=...
```

Dessa laddas automatiskt i Azure Static Web App via inställningar i portalen.

### 4. Starta lokalt

```bash
npm start
```

## 📁 Strukturen

- `/components` -> Auth, Sidebar, Footer
- `/hooks` -> useAuth, useRoles
- `/views/admin` -> Pages (Dashboard, Players, Teams, etc.)
- `/services` -> API-integrationer

## 🧪 Tester & felsökning

- Använd konsolloggar i RequireAdminRoute för att debugga claims och roller
- API-felet 403 från Express beror ofta på saknad eller felaktig token
- Validera att access_token skickas i header mot Azure API

## 📣 Roadmap

- Inloggning via MSAL
- Rollstyrning
- Integration WooCommerce
- CosmosDB backend
- Coach-kommentar & betygsfunktion
- Automatiserad dataanalys i Power BI
- Multitenant-support
- Fler API-integreringar (ex. IdrottOnline, Make, Baserow, Fabric, Clever)

## 💬 Support & Feedback

Har du problem eller feedback? Kontakta mirza.muhic@stockholmbasket.se

⸻

© 2025 Mirza Muhic / Insight Strategies AB. All rights reserved.  
MIT License.