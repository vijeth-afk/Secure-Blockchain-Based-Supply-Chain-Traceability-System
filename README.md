# Blockchain-Based Supply Chain Management (Medicine Tracking)

**A full-stack prototype demonstrating a blockchain-backed supply chain for pharmaceutical products with anomaly detection, distribution workflows, and provenance tracking.**

---

## 🚀 What this project does

This repository implements an end-to-end supply chain application that integrates:

- **Ethereum smart contract** (Truffle) for tracking medicines across supply chain stages (raw material → manufacturing → distribution → retail → sold)
- **Backend API** (Node.js + Express + MongoDB) for managing participants, manufacturing orders, distribution requests, inventory, and anomaly detection
- **Frontend UI** (React) for stakeholders to log in, create/manage inventory, handle distribution workflows, and visualize anomalies
- **Anomaly detection** system that scans stored supply chain data and raises alerts when suspicious patterns are detected

---

## 🧩 Architecture Overview

### Smart Contract (Blockchain)
- Contract: `contracts/SupplyChain.sol`
- Tracks participants (RMS, manufacturer, distributor, retailer) and medicine lifecycle stages
- Deployed using Truffle into a local Ganache/Ethereum network

### Backend (API + Database)
- Directory: `backend/`
- Runs on **http://localhost:5002** by default
- Provides REST endpoints for authentication, participants, manufacturing, distribution requests, raw materials, inventory, provenance, anomalies, and more
- Uses **MongoDB** (default: `mongodb://127.0.0.1:27017/supplychain`)
- Uses **Socket.IO** for real-time events

### Frontend (React)
- Directory: `client/`
- Runs on **http://localhost:3000** by default
- Consumes backend API and interacts with the smart contract artifacts at `client/src/artifacts/SupplyChain.json`

---

## ✅ Getting Started (Setup)

### Prerequisites

- Node.js (>= 18 recommended)
- npm
- MongoDB (local or remote)
- Ganache (CLI or GUI) or any Ethereum JSON-RPC provider (at `http://127.0.0.1:7545` by default)

### 1) Install dependencies

```bash
npm install
cd backend && npm install
cd ../client && npm install
```

### 2) Start MongoDB

Make sure MongoDB is running and accessible at `mongodb://127.0.0.1:27017/supplychain`.

### 3) Start Ganache (local blockchain)

Start Ganache and ensure it listens on `http://127.0.0.1:7545`.

### 4) Compile & deploy smart contract

From the repo root:

```bash
npx truffle compile
npx truffle migrate --network development
```

This will compile `contracts/SupplyChain.sol` and place the artifacts under `client/src/artifacts`.

### 5) Start backend + frontend

From the repo root (runs both in parallel):

```bash
npm start
```

Alternatively, run backend and client separately:

```bash
cd backend && npm run dev
cd ../client && npm start
```

---

## 🧪 How to Use

### Default Ports
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5002`
- Smart contract network (Ganache): `http://127.0.0.1:7545`

### Creating Users & Workflows

The app supports multiple roles (manufacturer, distributor, retailer). You can manage them from the UI or hit the backend endpoints directly.

### Distribution Workflow (Quick Reference)

For a full step-by-step distribution workflow, see: `QUICK_REFERENCE.md`.

### Anomaly Detection

The backend runs a scheduled anomaly scan every 6 hours and exposes anomalies via:

- `GET /api/anomalies`
- realtime updates via Socket.IO

For more details, see `backend/services/anomalyDetector.js` and `ANOMALY_DETECTION_DIAGNOSTIC.md`.

---

## 📁 Key Directories

- `contracts/` — Solidity smart contract(s)
- `migrations/` — Truffle deployment scripts
- `backend/` — Express server, models, routes, and services
- `client/` — React UI

---

## 🧪 Testing

There are no automated test suites included in this repository yet. You can test by using the UI or hitting the backend routes directly (see `QUICK_REFERENCE.md` for API payload examples).

---

## 🔎 Useful Docs & Guides

- `QUICK_REFERENCE.md` — Distribution workflow examples + API reference
- `DISTRIBUTION_WORKFLOW.md` — Detailed distribution workflow guide
- `DISTRIBUTION_USER_GUIDE.md` — User-facing guide for distribution features
- `ANOMALY_DETECTION_DIAGNOSTIC.md` — Anomaly detection diagnostics + workflows
- `IMPLEMENTATION_COMPLETE.md` — Project completion checklist / status

---

## ✅ Notes

- The smart contract is owned by the account that deploys it via Truffle. Only the owner can register participants and medicines.
- Backend expects MongoDB to be accessible locally; you can change the connection string in `backend/server.js`.

---

If you want help extending the project (e.g., adding automated tests, CI configuration, or integrating with a real Ethereum network), just ask!