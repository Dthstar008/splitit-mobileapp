# SplitIt!! 🧾

Fintech micro-billing app for group foodstuff bulk-buying and cost-sharing.

## Structure

```
splitit/
├── app/                    # Expo Router screens (file-based nav)
│   ├── _layout.tsx         # Root: providers + auth-switch
│   ├── (auth)/
│   │   ├── onboarding.tsx
│   │   ├── signup.tsx
│   │   └── login.tsx
│   └── (tabs)/
│       ├── home.tsx        # Active baskets + Split Engine launcher
│       ├── history.tsx
│       └── profile.tsx
├── components/split-engine/  # Step A→D basket creation flow
├── context/                  # AuthContext, SplitContext
├── services/api.ts           # Mock API layer (swap for real fetch calls)
├── theme/                    # colors.ts + useTheme/createStyles
├── types/
└── backend/                  # Node/Express/TS API + Paystack webhooks
```

## Frontend setup

```bash
npx create-expo-app splitit --template blank-typescript
# then copy app/, components/, context/, services/, theme/, types/ into the new project

npx expo install expo-router expo-clipboard expo-status-bar react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-svg react-native-qrcode-svg
npm install lucide-react-native

npx expo start
```

The app calls the backend at `http://localhost:4000` by default. For an Android
emulator, use `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`; for a physical phone,
use your computer's LAN IP, for example `EXPO_PUBLIC_API_URL=http://192.168.1.10:4000`.
Put that value in a root `.env` file before starting Expo.

Add to `package.json`: `"main": "expo-router/entry"`, and set `"scheme": "splitit"` in `app.json`.

## Backend setup

```bash
cd backend
npm install
cp .env.example .env   # fill in PAYSTACK_SECRET_KEY + PAYSTACK_WEBHOOK_SECRET when ready
npm run dev             # http://localhost:4000
```

Point Paystack's webhook URL (in your Paystack dashboard) at:
`https://your-domain.com/webhooks/paystack`

Without a live key, `createVirtualAccount` runs in mock mode automatically — full flow works end to end for demos.

## Split Engine flow

1. **Create Basket** — name, total cost, itemized list
2. **Add Payers** — by name or SplitIt ID; live split + 1.5% fee preview
3. **QR + Text Code** — `POST /baskets` generates BasketID, QR payload, and `SP-XXXX` code
4. **Dispatch** — WhatsApp deep link, mock email, or copy the text code

Anyone can later type the `SP-XXXX` code into the Home tab search bar to pull up their bill and pay into an auto-generated virtual account (Paystack DVA, mocked until keys are live).

## Notes

- All colors pull from `theme/colors.ts` — never hardcode hex in screens.
- `services/api.ts` mirrors `backend/src/services/split.service.ts` math exactly, so client-side previews match server truth.
- Webhook route uses raw-body HMAC-SHA512 verification + an idempotency set to survive Paystack retries safely.
