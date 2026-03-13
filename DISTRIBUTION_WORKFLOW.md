# Distribution Workflow Implementation Summary

## Overview
Implemented a complete distribution workflow where manufacturers can send distribution requests to distributors with approval/rejection capabilities.

## Backend Changes

### 1. New Model: `distributionRequestModel.js`
- Created DistributionRequest schema with fields:
  - `manufacturingId`, `batchId`, `productName`, `quantity`
  - `manufacturerId`, `manufacturerName`
  - `distributorId`, `distributorName`
  - `storageRequirements` (temperature, humidity, specialRequirements)
  - `status` (pending/approved/rejected)
  - `approvedBy`, `approvedAt`, `rejectionReason`
  - Timestamps (createdAt, updatedAt)

### 2. New Routes: `distributionRequestRoutes.js`
Endpoints:
- `POST /api/distribution-requests` - Create distribution request (MAN only)
  - Validates manufacturing item exists and belongs to manufacturer
  - Checks sufficient quantity available
  - Emits `distribution_created` SSE event
  
- `GET /api/distribution-requests/pending` - Get pending requests for distributor (DIS only)
  - Returns all pending requests for the authenticated distributor
  
- `GET /api/distribution-requests/sent` - Get sent requests for manufacturer (MAN only)
  
- `PATCH /api/distribution-requests/:id/approve` - Approve request (DIS only)
  - Updates status to 'approved'
  - Records approver and approval timestamp
  - Decrements manufacturing quantity
  - Emits `distribution_approved` SSE event
  
- `PATCH /api/distribution-requests/:id/reject` - Reject request (DIS only)
  - Updates status to 'rejected'
  - Records rejection reason
  - Emits `distribution_rejected` SSE event

### 3. Backend Configuration Updates
- `server.js`: Registered distributionRequestRoutes at `/api/distribution-requests`
- `events.js`: Added SSE event listeners for:
  - `distribution_created`
  - `distribution_approved`
  - `distribution_rejected`
- `eventBus.js`: Added named export alongside default export

## Frontend Changes

### 1. Manufacturing.js
Added distribution modal workflow:
- Loads list of distributors from `/api/participants?role=DIS`
- "Distribute" button (on completed items) opens modal
- Modal allows:
  - Select distributor from dropdown
  - Enter quantity to distribute (max = available quantity)
  - Submit → creates distribution request
- Real-time updates via SSE

### 2. DistributorInventory.js
Added pending distributions section:
- Loads pending distribution requests for logged-in distributor
- Displays "Pending Distributions" table with:
  - Manufacturer name, Product, Batch ID, Quantity
  - Storage requirements
  - Request date
  - "Approve" button → triggers approval flow
  - "Reject" button → prompts for rejection reason
- Real-time updates via SSE events:
  - `distribution_created`: Reloads pending distributions
  - `distribution_approved`: Reloads both pending and inventory
  - `distribution_rejected`: Reloads pending distributions
- Approval flow creates distributor inventory item automatically

## Workflow Summary

### As Manufacturer:
1. Create manufacturing item (completed status)
2. Click "Distribute" button
3. Modal opens: select distributor and quantity
4. Submit → distribution request sent
5. Receives SSE notification when distributor approves/rejects

### As Distributor:
1. View "Pending Distributions" section (shows requests for you)
2. Review manufacturer, product, quantity, storage requirements
3. Click "Approve" → receives inventory item, manufacturing qty decreases
4. Or click "Reject" → optionally provide reason

## Real-Time Events
- `distribution_created`: Notifies distributor of new request
- `distribution_approved`: Notifies manufacturer of approval, updates inventory
- `distribution_rejected`: Notifies manufacturer of rejection

## Security & Validation
- Role-based access control (MAN for creation, DIS for approval)
- Validates manufacturing item ownership
- Validates sufficient quantity before approval
- Wallet address tracking for all transactions
