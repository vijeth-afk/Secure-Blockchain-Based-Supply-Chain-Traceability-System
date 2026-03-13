# Distribution Workflow - Quick Reference

## For Developers

### Testing the Distribution Workflow

#### Prerequisites
- Backend running on port 5002
- MongoDB running
- Two test accounts: 1 MAN, 1 DIS

#### Step 1: Create Manufacturing Item (as MAN)
```bash
POST http://localhost:5002/api/manufacturing
Headers: Authorization: Bearer {jwt_token}
Body: {
  "productName": "Test Product",
  "batchId": "BATCH-001",
  "pricePerUnit": 100,
  "quantity": 50,
  "manufacturer": "0xMANUFACTURER_ADDRESS",
  "storageRequirements": {
    "temperature": "2-8°C",
    "humidity": "45-55%",
    "specialRequirements": "Keep away from light"
  }
}
```

#### Step 2: Mark Completed (as MAN)
```bash
PATCH http://localhost:5002/api/manufacturing/{item_id}
Body: { "status": "completed" }
```

#### Step 3: Create Distribution Request (as MAN)
```bash
POST http://localhost:5002/api/distribution-requests
Headers: Authorization: Bearer {jwt_token}
Body: {
  "manufacturingId": "{item_id}",
  "distributorId": "0xDISTRIBUTOR_ADDRESS",
  "quantity": 20
}
```

#### Step 4: Get Pending Requests (as DIS)
```bash
GET http://localhost:5002/api/distribution-requests/pending
Headers: Authorization: Bearer {jwt_token}
```

#### Step 5: Approve Request (as DIS)
```bash
PATCH http://localhost:5002/api/distribution-requests/{request_id}/approve
Headers: Authorization: Bearer {jwt_token}
```

Or Reject:
```bash
PATCH http://localhost:5002/api/distribution-requests/{request_id}/reject
Headers: Authorization: Bearer {jwt_token}
Body: { "reason": "Insufficient storage capacity" }
```

### SSE Event Subscription

Open DevTools Console and run:
```javascript
const eventSource = new EventSource('http://localhost:5002/api/events/stream');

eventSource.addEventListener('distribution_created', (e) => {
  console.log('New distribution request:', JSON.parse(e.data));
});

eventSource.addEventListener('distribution_approved', (e) => {
  console.log('Distribution approved:', JSON.parse(e.data));
});

eventSource.addEventListener('distribution_rejected', (e) => {
  console.log('Distribution rejected:', JSON.parse(e.data));
});
```

---

## API Reference

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /api/distribution-requests | MAN | Create distribution request |
| GET | /api/distribution-requests/pending | DIS | Get pending requests for distributor |
| GET | /api/distribution-requests/sent | MAN | Get sent requests by manufacturer |
| PATCH | /api/distribution-requests/:id/approve | DIS | Approve distribution request |
| PATCH | /api/distribution-requests/:id/reject | DIS | Reject distribution request |

---

## Database Schema

### DistributionRequest
```javascript
{
  _id: ObjectId,
  
  // Manufacturing Info
  manufacturingId: ObjectId,
  batchId: String,
  productName: String,
  quantity: Number,
  
  // Manufacturer Info
  manufacturerId: String (wallet address),
  manufacturerName: String,
  
  // Distributor Info
  distributorId: String (wallet address),
  distributorName: String,
  
  // Storage Requirements (copied from manufacturing)
  storageRequirements: {
    temperature: String,
    humidity: String,
    specialRequirements: String
  },
  
  // Status Flow
  status: String (enum: 'pending', 'approved', 'rejected'),
  
  // Approval Tracking
  approvedBy: String (wallet address),
  approvedAt: Date,
  rejectionReason: String,
  
  // Timeline
  createdAt: Date,
  updatedAt: Date
}
```

---

## File Structure

```
backend/
├── models/
│   └── distributionRequestModel.js ✨ NEW
├── routes/
│   ├── distributionRequestRoutes.js ✨ NEW
│   ├── events.js (UPDATED)
│   └── ...other routes...
├── utils/
│   └── eventBus.js (UPDATED - added named export)
└── server.js (UPDATED - registered routes)

client/src/
├── Manufacturing.js (UPDATED - added distribution modal)
├── DistributorInventory.js (UPDATED - added pending distributions)
└── ...other components...
```

---

## State Management

### Manufacturing.js
```javascript
const [showDistributeModal, setShowDistributeModal] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);
const [distributeForm, setDistributeForm] = useState({
  distributorId: '',
  quantity: ''
});
const [distributors, setDistributors] = useState([]);
```

### DistributorInventory.js
```javascript
const [pendingDistributions, setPendingDistributions] = useState([]);
```

---

## Common Issues & Solutions

### Issue: "Distribution request not found"
**Solution**: Ensure the request ID is valid and in MongoDB

### Issue: "Insufficient quantity"
**Solution**: Ensure the requested quantity doesn't exceed available manufacturing quantity

### Issue: "You are not the intended distributor"
**Solution**: Log in as the correct distributor account

### Issue: SSE events not updating
**Solution**: 
- Check EventSource connection in browser DevTools
- Verify eventBus is emitting events in backend logs
- Check browser console for connection errors

### Issue: Cannot approve/reject already processed request
**Solution**: Status must be 'pending' to approve or reject

---

## Monitoring

### Check Backend Logs
```powershell
# View last 20 lines
Get-Content "c:\Users\Vijeth RV\OneDrive\Desktop\Blockchain-Based-Supply-Chain-recent-master\backend\server.js" -Tail 20
```

### Verify MongoDB Data
```bash
# Connect to MongoDB
mongo

# Switch to database
use supplychain

# View distribution requests
db.distributionrequests.find().pretty()

# Count by status
db.distributionrequests.countDocuments({ status: 'pending' })
db.distributionrequests.countDocuments({ status: 'approved' })
```

### Check SSE Connection
Open browser DevTools → Network → Filter "stream" → Check EventSource status

---

## Performance Tips

1. **Indexing**: Queries already indexed on distributorId, manufacturerId, status
2. **Real-time**: SSE is lightweight for 1-way server→client
3. **Scalability**: Consider WebSocket if bidirectional communication needed
4. **Batching**: Could batch approve multiple requests (future enhancement)

---

## Security Checklist

✅ JWT authentication required on all endpoints
✅ Role-based authorization (MAN, DIS)
✅ Manufacturing ownership verified
✅ Wallet address extracted from token
✅ SQL injection prevention (Mongoose ORM)
✅ CORS enabled for frontend
✅ Request validation on all inputs

---

## Deployment Notes

1. Set `NODE_ENV=production` for production
2. Use environment variables for JWT secret (currently using fallback)
3. Enable SSL/TLS for production
4. Consider implementing request rate limiting
5. Add request logging/auditing
6. Implement transaction rollback on approval failure

---

## Support

For issues or questions:
1. Check the user guide: `DISTRIBUTION_USER_GUIDE.md`
2. Review implementation details: `DISTRIBUTION_WORKFLOW.md`
3. Check logs in backend terminal
4. Verify MongoDB connection
5. Test SSE connection in browser
