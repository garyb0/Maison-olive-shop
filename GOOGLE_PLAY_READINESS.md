# Chez Olive Android / Google Play Readiness

Last updated: 2026-05-18

## Package

- App ID: `ca.chezolive.app`
- App name: `Chez Olive`
- Production entry: `https://chezolive.ca/app`
- Public Play positioning: local pet shop for Rimouski families: boutique, account, orders, support, local delivery, and reassuring dog QR profiles.
- Admin and delivery routes remain available by role, but they are not the app store promise.
- Current release gate: `npm run release:solid` passed on 2026-05-05.

## Current State

- Google Play app exists for package `ca.chezolive.app`.
- Internal testing can receive Android App Bundles from this project.
- Firebase project has been created and `android/app/google-services.json` is present locally.
- The customer app shell is the primary Play Store experience: `/app`, `/boutique`, product, cart, checkout, account/orders, and support.
- App/PWA launcher icons now use the Olive face mark from the site header.
- Web changes deploy through `https://chezolive.ca/app`; generate a new Android bundle only when native config, plugins, signing, package metadata, or bundled assets change.
- Production ops may still report one business signal to review manually: `lit-douillet-anti-stress(0)` active/visible but not buyable. Resolve before a visible Play push by restocking, disabling, or intentionally accepting the out-of-stock listing.

## Firebase Setup

- Done locally:
  - Firebase project: `Chez Olive App`.
  - Android app package: `ca.chezolive.app`.
  - `android/app/google-services.json` installed locally.
- Still required before production native push sending:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

## Meta Messenger Sharing

- Product sharing supports Messenger through the native Android share sheet by default.
- For a desktop/web Messenger flow where the customer chooses a recipient, create a Meta Developer app for Chez Olive, authorize `chezolive.ca`, then set:
  - `NEXT_PUBLIC_FACEBOOK_APP_ID`
  - `NEXT_PUBLIC_FACEBOOK_SEND_REDIRECT_URL=https://chezolive.ca/boutique`
- After setting those public variables, rebuild and redeploy the web app; no new Android bundle is required.

## Data Safety Draft

Data collected or processed:

- Account: name, email, password hash, session data, language, security settings.
- Orders: products, quantities, totals, order status, payment status, delivery status.
- Delivery: address, postal code, delivery phone, delivery instructions, delivery slot.
- Support: messages, guest support token, internal support metadata.
- Dog QR profiles: dog name, photo URL, age label, owner phone, notes, public visibility choices.
- Notifications: web push subscription, Android FCM token, preferences, read state.
- Payments: handled by Stripe; Chez Olive does not store full card numbers.
- Diagnostics/security: rate limits, audit logs, conversion events without payment card data.

Purposes:

- App functionality
- Order fulfillment
- Customer support
- Fraud prevention and security
- Notifications requested by the user
- Analytics/conversion measurement for shop operation

Sharing:

- Stripe for payment processing.
- Firebase Cloud Messaging for Android push delivery.
- Email/SMS providers when configured for transactional support and order communication.

## Store Assets To Produce

- 512x512 app icon derived from the Olive face mark.
- Feature graphic: 1024x500 focused on the real Chez Olive app promise: local delivery, order tracking, and dog QR reassurance.
- Phone screenshots:
  - App home `/app`
  - Boutique `/boutique`
  - Product detail
  - Cart
  - Checkout
  - Account orders
  - Support
- Optional extra screenshot if the flow is ready: dog QR lost-mode/profile screen.
- Short description in French and English.
- Full description in French and English.

Draft listing copy is tracked in:

- `play-store/listing-fr-CA.md`
- `play-store/listing-en-CA.md`

Screenshot capture command:

- Start the app locally on `localhost` (Playwright hydration is more reliable than `127.0.0.1` with Next dev).
- Run `npm run android:screenshots`.
- Review files in `test-results/play-store-screenshots`:
  - `01-app-home.png`
  - `02-shop.png`
  - `03-product.png`
  - `04-cart.png`
  - `05-checkout.png`
  - `06-orders.png`
  - `07-support.png`

## Signing Setup

The Android project is ready to sign release builds when the private signing files exist:

- Copy `android/key.properties.example` to `android/key.properties`.
- Create or place the release keystore at `android/app/chezolive-release.keystore`.
- Keep both files private. They are ignored by git.
- Use strong passwords and store them in a password manager.

Example keystore command once Java/JDK 21 is installed:

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/chezolive-release.keystore -alias chezolive -keyalg RSA -keysize 2048 -validity 10000
```

## Release Checklist

- `npm run lint`
- `npm run test:critical`
- `npm run test:module:admin`
- `npm run test:module:orders`
- `npm run build`
- `npm run android:screenshots`
- `npx cap sync android`
- `npm run android:doctor`
- `npm run android:bundle` once Android SDK, signing config, and `google-services.json` are ready.
- Upload `.aab` to an internal testing release first.

## Human Review

- Legal pages `/privacy` and `/terms` need owner/legal review before production listing.
- Data Safety answers must be copied into Play Console and validated against actual production providers.
- Google Play developer account creation and Firebase project creation happen outside the codebase.
- Subscription claims should stay modest until the live recurring Stripe flow has been validated end-to-end.
