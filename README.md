# TransMove — Production Marketplace Platform

TransMove is a real, production-oriented transportation, ride-request, logistics freight, driver hiring, and heavy machinery marketplace built around a fair driver bidding model.

---

## 🚀 Key Features

* **Real Supabase Backend**: Sole backend with PostgreSQL, Supabase Auth, Row Level Security (RLS), Supabase Storage, and Realtime channels.
* **Zero Simulated / Demo Data**: Starts intentionally empty. Real accounts, real vehicles, real bids, real messages, and real transactions.
* **TransMove Bidding**: Customers post requests with suggested budgets; verified drivers submit price & ETA bids; real-time counter-offers and race-condition-safe acceptance.
* **Logistics & Cargo Freight**: Full support for moving goods, agricultural produce, bakkie/truck loads with weight and dimension specifications.
* **Heavy Machinery Hire**: Direct equipment listings for tractors, excavators, tippers, cranes, and flatbeds by verified owners.
* **Driver Onboarding & Verification**: Multi-step onboarding with vehicle specs and documentation uploads to Supabase Storage; admin approval queue.
* **Real Location & Maps**: Interactive Leaflet maps with GPS coordinate auto-detection (`navigator.geolocation`), OpenStreetMap geocoding, and distance calculation.
* **Paynow Payment Verification**: Real Paynow payment checkout with transaction ledger and server-verified subscription activation.
* **Hidden Admin Management**: Server-enforced role access for verifying drivers, auditing dispute logs, and viewing financial ledgers.
* **Pristine Light Theme UI**: High-contrast, clean modern aesthetic with dedicated empty states.

---

## 🛠️ Supabase Database Setup

1. Open your **[Supabase Project Dashboard](https://supabase.com/dashboard)**.
2. Go to the **SQL Editor** on the left menu.
3. Paste the contents of:
   - [`sql/schema.sql`](sql/schema.sql) (Tables, indexes, triggers, stored functions)
   - [`sql/rls.sql`](sql/rls.sql) (Row Level Security policies)
   - [`sql/storage.sql`](sql/storage.sql) (Storage buckets for avatars, vehicles, documents, equipment)
4. Click **Run** to execute the scripts.

---

## ⚙️ Configuration & Connection

1. Copy `.env.example` or open **TransMove** in your browser.
2. Click **Settings** or the **⚙️ Supabase Settings** button on the Profile page.
3. Enter your live Supabase Project URL and Public Anon Key.
4. All real-time channels, auth workflows, and storage uploads will connect immediately.

---

## 📂 Project Structure

```
Transmove/
├── index.html                  # Main SPA entry point
├── assets/
│   ├── css/
│   │   └── style.css           # Pristine Light Theme design system
│   └── js/
│       └── app.js              # Central router and application controller
├── src/
│   ├── config/
│   │   ├── supabase.js         # Supabase client & connection validator
│   │   └── paynow.js           # Paynow payment gateway configuration
│   ├── services/
│   │   ├── auth.js             # Supabase Auth, registration & RBAC
│   │   ├── location.js         # Real GPS geolocation & OSM geocoding
│   │   ├── requests.js         # Ride, freight & hire request service
│   │   ├── offers.js           # TransMove bidding & negotiation engine
│   │   ├── booking.js          # Confirmed trip lifecycle & reviews
│   │   ├── vehicles.js         # Driver vehicle management & storage
│   │   ├── equipment.js        # Machinery & equipment listings
│   │   ├── messaging.js        # Realtime chat per booking
│   │   ├── subscriptions.js    # Plans & Paynow payment checkout
│   │   └── admin.js            # Server-verified admin approvals & ledger
│   ├── views/
│   │   ├── HomeView.js         # Landing page & quick fare estimator
│   │   ├── AuthView.js         # Sign in & role-based registration
│   │   ├── CustomerView.js     # Customer request creation & live bids board
│   │   ├── DriverView.js       # Driver cockpit, requests feed & vehicle onboarding
│   │   ├── OwnerView.js        # Heavy machinery owner fleet management
│   │   ├── AdminView.js        # Hidden admin verification & audit portal
│   │   ├── EquipmentView.js    # Public machinery marketplace
│   │   ├── MessagesView.js     # Realtime booking chat
│   │   ├── SubscriptionsView.js# Subscription plans & Paynow flow
│   │   └── ProfileView.js      # User profile & credentials configuration
│   └── components/
│       ├── Navbar.js           # Role-aware dynamic navbar
│       ├── EmptyState.js       # Professional zero-data indicators
│       └── Modal.js            # Universal interactive modal system
├── sql/
│   ├── schema.sql              # Core database schema & triggers
│   ├── rls.sql                 # Row Level Security policies
│   └── storage.sql             # Storage bucket configurations
├── .env.example                # Environment configuration template
└── README.md                   # Documentation and setup guide
```
