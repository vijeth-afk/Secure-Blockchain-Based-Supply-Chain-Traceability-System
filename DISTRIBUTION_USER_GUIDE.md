# Distribution Workflow - User Guide

## What's New

You now have a complete distribution approval workflow instead of the old "Mark Shipped" approach. This provides better control and visibility for distributors.

## Step-by-Step Guide

### For Manufacturers (MAN Role)

#### 1. Create a Manufacturing Item
- Navigate to Manufacturing page
- Fill in: Product Name, Batch ID, Price, Quantity, Storage Requirements
- Click "Add Item"

#### 2. Mark as Completed
- Find your item in the table
- Click "Mark Completed" (changes status from "in-production" to "completed")

#### 3. Distribute to Distributor
- Click the "Distribute" button on a completed item
- A modal dialog appears showing:
  - Product name and batch ID
  - Available quantity
  - Dropdown to select a distributor
  - Input field for quantity to distribute
- Select a distributor from the dropdown
- Enter the quantity you want to send
- Click "Send Distribution Request"
- The request is sent to the distributor

#### 4. Wait for Approval
- You'll see the item status remains "completed"
- Once the distributor approves, the quantity will be decremented
- You receive real-time notifications via SSE

---

### For Distributors (DIS Role)

#### 1. View Pending Distributions
- Navigate to Distributor Inventory page
- Look for the "Pending Distributions" section at the top
- This shows all distribution requests awaiting your approval
- Displays: Manufacturer, Product, Batch ID, Quantity, Storage Requirements, Request Date

#### 2. Review the Request
- Each row shows:
  - **From Manufacturer**: Who is sending this
  - **Product**: Name of the product
  - **Batch ID**: Which batch this is from
  - **Quantity**: How many units
  - **Storage Requirements**: Temperature, Humidity, Special Requirements
  - **Requested Date**: When the request was made

#### 3. Approve the Distribution
- Click "Approve" button on the request
- The request is approved immediately
- A new item is automatically added to your "Distributor Inventory"
- The manufacturer's quantity is decremented
- You see real-time updates via SSE

#### 4. Reject the Distribution
- Click "Reject" button on the request
- A prompt asks for a rejection reason (optional)
- The request is marked as rejected
- The manufacturer is notified

#### 5. Manage Your Inventory
- Once approved, the item appears in the "Distributor Inventory" table below
- You can edit warehouse location, shipping status, etc.
- You can distribute to retailers from here

---

## Real-Time Updates

All pages subscribe to Server-Sent Events (SSE) for real-time updates:

- **Manufacturers**: See when distributors approve/reject your requests
- **Distributors**: See new distribution requests immediately
- **Both**: Inventory updates happen in real-time across all participants

---

## Status Flow

```
Manufacturing Created (in-production)
    ↓
Mark Completed (completed)
    ↓
Click Distribute (still completed, but pending distribution)
    ↓
Distributor Sees Pending Request
    ├→ APPROVE
    │   ├→ Request marked as 'approved'
    │   ├→ New inventory item created for distributor
    │   ├→ Manufacturer quantity decremented
    │   └→ SSE notifications sent
    │
    └→ REJECT
        ├→ Request marked as 'rejected'
        ├→ Optional rejection reason recorded
        └→ SSE notification sent
```

---

## Key Differences from Previous Workflow

| Feature | Old (Mark Shipped) | New (Distribution Workflow) |
|---------|-------------------|---------------------------|
| Shipping Decision | Automatic | Requires distributor approval |
| Distributor Visibility | None | Sees all pending requests |
| Rejection Handling | Not possible | Can reject with reason |
| Real-time Updates | Limited | Full SSE support |
| Inventory Automation | Manual | Auto-created on approval |
| Accountability | Low | High (tracks approver & timestamp) |

---

## Database Models Involved

1. **Manufacturing** - Source of distribution
2. **DistributionRequest** - New model for requests
3. **DistributorInventory** - Destination after approval
4. **User** - Tracks manufacturer and distributor information

---

## API Endpoints

### Create Distribution Request
```
POST /api/distribution-requests
Body: {
  manufacturingId: "string (MongoDB ID)",
  distributorId: "string (wallet address)",
  quantity: number
}
Response: 201 Created { distributionRequest }
```

### Get Pending for Distributor
```
GET /api/distribution-requests/pending
Response: 200 OK [ { id, quantity, manufacturerName, ... } ]
```

### Approve Distribution
```
PATCH /api/distribution-requests/:id/approve
Response: 200 OK { distributionRequest with status: 'approved' }
```

### Reject Distribution
```
PATCH /api/distribution-requests/:id/reject
Body: { reason: "optional string" }
Response: 200 OK { distributionRequest with status: 'rejected' }
```

---

## Testing the Workflow

1. **Manufacturer**: Create → Complete → Distribute
2. **Distributor**: Check Pending → Approve
3. **Manufacturer**: Verify quantity decremented in table
4. **Distributor**: See new inventory item created
5. **Both**: Observe SSE notifications in real-time
