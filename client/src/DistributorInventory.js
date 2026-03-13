import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import Web3 from "web3";
import axios from "axios";
import { canEdit } from './permissions';
import "./DistributorInventory.css";

function DistributorInventory() {
    const history = useHistory();
    const [currentaccount, setCurrentaccount] = useState("");
    const [inventory, setInventory] = useState([]);
    const [pendingDistributions, setPendingDistributions] = useState([]);
    const [incomingOrders, setIncomingOrders] = useState([]);
    const [manufacturers, setManufacturers] = useState([]);
    const [retailers, setRetailers] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [existingBatchIds, setExistingBatchIds] = useState([]);
    const [existingProductNames, setExistingProductNames] = useState([]);
    const [useCustomBatch, setUseCustomBatch] = useState(false);
    const [useCustomProduct, setUseCustomProduct] = useState(false);

    const [newItem, setNewItem] = useState({
        batchId: "",
        productName: "",
        receivedFromManufacturer: {
            manufacturerId: "",
            manufacturerName: "",
            receiptDate: new Date().toISOString().split('T')[0]
        },
        distributedToRetailer: {
            retailerId: "",
            retailerName: "",
            distributionDate: new Date().toISOString().split('T')[0]
        },
        storageConditions: {
            temperature: "",
            humidity: "",
            specialRequirements: ""
        },
        warehouseLocation: {
            address: "",
            section: "",
            shelf: ""
        },
        shippingDetails: {
            status: "pending",
            cost: "",
            expectedDeliveryDate: new Date().toISOString().split('T')[0]
        },
        quantity: ""
    });

    useEffect(() => {
        loadWeb3();
        loadInventory();
        loadPendingDistributions();
        loadIncomingOrders();
        loadParticipants();
        loadRawMaterials();
    }, []);

    // Real-time updates via Server-Sent Events
    useEffect(() => {
        const esUrl = (axios.defaults.baseURL || 'http://localhost:5002') + '/api/events/stream';
        const evtSource = new EventSource(esUrl);

        evtSource.addEventListener('distributor_inventory_created', (e) => {
            try {
                const payload = JSON.parse(e.data);
                if (payload.distributorId && payload.distributorId.toLowerCase() === (currentaccount || '').toLowerCase()) {
                    loadInventory();
                }
            } catch (err) { }
        });

        evtSource.addEventListener('distribution_created', (e) => {
            try {
                const payload = JSON.parse(e.data);
                if (payload.distributorId && payload.distributorId.toLowerCase() === (currentaccount || '').toLowerCase()) {
                    loadPendingDistributions();
                }
            } catch (err) { }
        });

        evtSource.addEventListener('distribution_approved', (e) => {
            try {
                const payload = JSON.parse(e.data);
                loadPendingDistributions();
                loadInventory();
            } catch (err) { }
        });

        return () => {
            evtSource.close();
        };
    }, [currentaccount]);

    const loadWeb3 = async () => {
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            await window.ethereum.enable();
        } else if (window.web3) {
            window.web3 = new Web3(window.web3.currentProvider);
        } else {
            window.alert("Non-Ethereum browser detected. Please install MetaMask!");
        }
        const web3 = window.web3;
        const accounts = await web3.eth.getAccounts();
        setCurrentaccount(accounts[0]);
        setTimeout(() => loadInventory(), 200);
    };

    const loadRawMaterials = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const res = await axios.get(`${base}/api/rawmaterials`);
            const types = Array.from(new Set(res.data.map(r => r.type).filter(Boolean)));
            setExistingProductNames(prev => Array.from(new Set([...(prev || []), ...types])));
        } catch (err) { }
    };

    const loadParticipants = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            // Fetch users and participants for MAN and RET roles, then merge by normalized address
            const usersManPromise = axios.get(`${base}/api/users?role=MAN`);
            const partsManPromise = axios.get(`${base}/api/participants?role=MAN`);
            const usersRetPromise = axios.get(`${base}/api/users?role=RET`);
            const partsRetPromise = axios.get(`${base}/api/participants?role=RET`);

            const [usersManRes, partsManRes, usersRetRes, partsRetRes] = await Promise.allSettled([
                usersManPromise,
                partsManPromise,
                usersRetPromise,
                partsRetPromise
            ]);

            const usersMan = usersManRes.status === 'fulfilled' ? (usersManRes.value.data || []) : [];
            const partsMan = partsManRes.status === 'fulfilled' ? (partsManRes.value.data || []) : [];
            const usersRet = usersRetRes.status === 'fulfilled' ? (usersRetRes.value.data || []) : [];
            const partsRet = partsRetRes.status === 'fulfilled' ? (partsRetRes.value.data || []) : [];

            const mergeByAddress = (usersArray, partsArray) => {
                const map = new Map();
                usersArray.forEach(u => {
                    const addr = (u.walletAddress || '').toString().toLowerCase();
                    if (addr) map.set(addr, { _id: u._id, name: u.name, walletAddress: u.walletAddress });
                });
                partsArray.forEach(p => {
                    const addr = (p.address || '').toString().toLowerCase();
                    if (addr && !map.has(addr)) map.set(addr, { _id: p._id, name: p.name, walletAddress: p.address });
                });
                return Array.from(map.values());
            };

            setManufacturers(mergeByAddress(usersMan, partsMan));
            setRetailers(mergeByAddress(usersRet, partsRet));
        } catch (error) {
            console.error("Error loading participants:", error);
        }
    };

    const loadInventory = async () => {
        try {
            const response = await axios.get("http://localhost:5002/api/distributor-inventory");
            setInventory(response.data);
            const batches = Array.from(new Set(response.data.map(i => i.batchId).filter(Boolean)));
            const products = Array.from(new Set(response.data.map(i => i.productName).filter(Boolean)));
            setExistingBatchIds(batches);
            setExistingProductNames(products);
        } catch (error) {
            console.error("Error loading inventory:", error);
        }
    };

    const loadPendingDistributions = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const response = await axios.get(`${base}/api/distribution-requests/pending`);
            setPendingDistributions(response.data);
        } catch (error) {
            console.log('Distribution requests not available:', error);
        }
    };

    const loadIncomingOrders = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const response = await axios.get(`${base}/api/retailer-orders/distributor/pending`);
            setIncomingOrders(response.data);
        } catch (error) {
            console.log('Distribution requests not available:', error);
        }
    };

    const handleInputChange = (e, section = null, subsection = null) => {
        const { name, value } = e.target;

        if (section && subsection) {
            setNewItem(prev => ({
                ...prev,
                [section]: {
                    ...prev[section],
                    [subsection]: value
                }
            }));
        } else if (section) {
            setNewItem(prev => ({
                ...prev,
                [section]: {
                    ...prev[section],
                    [name]: value
                }
            }));
        } else {
            setNewItem(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleManufacturerSelect = (e) => {
        const manufacturer = manufacturers.find(m => (m.walletAddress || '').toLowerCase() === (e.target.value || '').toLowerCase());
        if (manufacturer) {
            setNewItem(prev => ({
                ...prev,
                receivedFromManufacturer: {
                    ...prev.receivedFromManufacturer,
                    manufacturerId: manufacturer.walletAddress,
                    manufacturerName: manufacturer.name
                }
            }));
        }
    };

    const handleRetailerSelect = (e) => {
        const retailer = retailers.find(r => (r.walletAddress || '').toLowerCase() === (e.target.value || '').toLowerCase());
        if (retailer) {
            setNewItem(prev => ({
                ...prev,
                distributedToRetailer: {
                    ...prev.distributedToRetailer,
                    retailerId: retailer.walletAddress,
                    retailerName: retailer.name
                }
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await axios.patch(
                    `http://localhost:5002/api/distributor-inventory/${editingItem._id}`,
                    {
                        ...newItem,
                        distributorId: currentaccount
                    }
                );
            } else {
                await axios.post("http://localhost:5002/api/distributor-inventory", {
                    ...newItem,
                    distributorId: currentaccount
                });
            }

            setNewItem({
                batchId: "",
                productName: "",
                receivedFromManufacturer: {
                    manufacturerId: "",
                    manufacturerName: "",
                    receiptDate: new Date().toISOString().split('T')[0]
                },
                distributedToRetailer: {
                    retailerId: "",
                    retailerName: "",
                    distributionDate: new Date().toISOString().split('T')[0]
                },
                storageConditions: {
                    temperature: "",
                    humidity: "",
                    specialRequirements: ""
                },
                warehouseLocation: {
                    address: "",
                    section: "",
                    shelf: ""
                },
                shippingDetails: {
                    status: "pending",
                    cost: "",
                    expectedDeliveryDate: new Date().toISOString().split('T')[0]
                },
                quantity: ""
            });
            setEditingItem(null);
            loadInventory();
        } catch (error) {
            console.error("Error saving inventory item:", error);
            alert("Error saving inventory item. Please try again.");
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setNewItem({
            ...item,
            receivedFromManufacturer: {
                ...item.receivedFromManufacturer,
                receiptDate: new Date(item.receivedFromManufacturer?.receiptDate || new Date()).toISOString().split('T')[0]
            },
            distributedToRetailer: {
                ...item.distributedToRetailer,
                distributionDate: new Date(item.distributedToRetailer?.distributionDate || new Date()).toISOString().split('T')[0]
            },
            shippingDetails: {
                ...item.shippingDetails,
                expectedDeliveryDate: new Date(item.shippingDetails?.expectedDeliveryDate || new Date()).toISOString().split('T')[0]
            }
        });
        setUseCustomBatch(prev => {
            try {
                return !(existingBatchIds || []).includes(item.batchId);
            } catch (e) { return false; }
        });
        setUseCustomProduct(prev => {
            try {
                return !(existingProductNames || []).includes(item.productName);
            } catch (e) { return false; }
        });
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this item?")) {
            try {
                await axios.delete(`http://localhost:5002/api/distributor-inventory/${id}`);
                loadInventory();
            } catch (error) {
                console.error("Error deleting item:", error);
                alert("Error deleting item. Please try again.");
            }
        }
    };

    const handleApproveDistribution = async (id) => {
        if (window.confirm("Approve this distribution request?")) {
            try {
                const base = axios.defaults.baseURL || 'http://localhost:5002';
                await axios.patch(`${base}/api/distribution-requests/${id}/approve`);
                loadPendingDistributions();
                loadInventory();
            } catch (error) {
                console.error("Error approving distribution:", error);
                alert(error.response?.data?.error || "Error approving distribution request");
            }
        }
    };

    const handleRejectDistribution = async (id) => {
        const reason = window.prompt("Enter rejection reason (optional):");
        if (reason !== null) {
            try {
                const base = axios.defaults.baseURL || 'http://localhost:5002';
                await axios.patch(
                    `${base}/api/distribution-requests/${id}/reject`,
                    { reason }
                );
                loadPendingDistributions();
            } catch (error) {
                console.error("Error rejecting distribution:", error);
                alert(error.response?.data?.error || "Error rejecting distribution request");
            }
        }
    };

    const handleApproveOrder = async (orderId) => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            await axios.patch(`${base}/api/retailer-orders/${orderId}/approve`);
            alert("Order approved and inventory assigned!");
            loadIncomingOrders();
            loadInventory();
        } catch (error) {
            console.error("Error approving order:", error);
            alert("Failed to approve order: " + (error.response?.data?.message || error.message));
        }
    };

    const handleRejectOrder = async (orderId) => {
        const reason = prompt("Enter rejection reason:");
        if (reason === null) return;

        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            await axios.patch(`${base}/api/retailer-orders/${orderId}/reject`, { reason });
            alert("Order rejected.");
            loadIncomingOrders();
        } catch (error) {
            console.error("Error rejecting order:", error);
            alert("Failed to reject order: " + (error.response?.data?.message || error.message));
        }
    };

    const redirect_to_home = () => {
        history.push("/home");
    }

    const role = localStorage.getItem('userRole');
    const editable = canEdit('distributor', role);

    return (
        <div className="dist-page">
            <div className="dist-grid" aria-hidden="true" />
            <div className="dist-glow" aria-hidden="true" />
            <div className="dist-content">
                <div className="dist-header">
                    <div>
                        <p className="eyebrow">Distribution Control</p>
                        <h2>Distributor Inventory</h2>
                        <p className="subcopy">
                            Orchestrate inbound batches, warehouse placement, and outbound shipments with one neon dashboard.
                        </p>
                        <p className="subcopy subtle">
                            <b>Account:</b> {currentaccount || 'Loading wallet...'}
                        </p>
                    </div>
                    <button onClick={redirect_to_home} className="dist-btn danger">
                        Back to Home
                    </button>
                </div>

                <div className="dist-card">
                    <div className="card-title-row">
                        <h5>{editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h5>
                        <span className="badge beta">Live Sync</span>
                    </div>
                    <div className="card-body">
                        {editable ? (
                            <form onSubmit={handleSubmit} className="row g-3">
                                {/* Basic Info */}
                                <div className="col-md-4">
                                    <label className="form-label">Product/Batch ID</label>
                                    {!useCustomBatch ? (
                                        <select
                                            className="form-select dist-input"
                                            value={newItem.batchId || ""}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === '__custom__') {
                                                    setUseCustomBatch(true);
                                                    setNewItem(prev => ({ ...prev, batchId: '' }));
                                                } else {
                                                    setNewItem(prev => ({ ...prev, batchId: v }));
                                                }
                                            }}
                                            required
                                        >
                                            <option value="">Select or create</option>
                                            {existingBatchIds.map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                            <option value="__custom__">-- Create new batch ID --</option>
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            name="batchId"
                                            value={newItem.batchId}
                                            onChange={(e) => handleInputChange(e)}
                                            className="form-control dist-input"
                                            required
                                        />
                                    )}
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Product Name</label>
                                    {!useCustomProduct ? (
                                        <select
                                            className="form-select dist-input"
                                            value={newItem.productName || ""}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === '__custom__') {
                                                    setUseCustomProduct(true);
                                                    setNewItem(prev => ({ ...prev, productName: '' }));
                                                } else {
                                                    setNewItem(prev => ({ ...prev, productName: v }));
                                                }
                                            }}
                                            required
                                        >
                                            <option value="">Select or create</option>
                                            {existingProductNames.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                            <option value="__custom__">-- Create new product --</option>
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            name="productName"
                                            value={newItem.productName}
                                            onChange={(e) => handleInputChange(e)}
                                            className="form-control dist-input"
                                            required
                                        />
                                    )}
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Quantity</label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        value={newItem.quantity}
                                        onChange={handleInputChange}
                                        className="form-control dist-input"
                                        min="0"
                                        required
                                    />
                                </div>

                                {/* Manufacturer Details */}
                                <div className="col-md-4">
                                    <label className="form-label">Received From Manufacturer</label>
                                    <select
                                        className="form-select dist-input"
                                        value={newItem.receivedFromManufacturer.manufacturerId}
                                        onChange={handleManufacturerSelect}
                                        required
                                    >
                                        <option value="">Select Manufacturer</option>
                                        {manufacturers.map(man => (
                                            <option key={man.walletAddress || man._id} value={man.walletAddress}>
                                                {man.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Receipt Date</label>
                                    <input
                                        type="date"
                                        value={newItem.receivedFromManufacturer.receiptDate}
                                        onChange={(e) => handleInputChange(e, 'receivedFromManufacturer', 'receiptDate')}
                                        className="form-control dist-input"
                                        required
                                    />
                                </div>

                                {/* Storage Conditions */}
                                <div className="col-md-4">
                                    <label className="form-label">Temperature Requirements</label>
                                    <input
                                        type="text"
                                        name="temperature"
                                        value={newItem.storageConditions.temperature}
                                        onChange={(e) => handleInputChange(e, 'storageConditions')}
                                        className="form-control dist-input"
                                        placeholder="e.g., 2-8°C"
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Humidity Requirements</label>
                                    <input
                                        type="text"
                                        name="humidity"
                                        value={newItem.storageConditions.humidity}
                                        onChange={(e) => handleInputChange(e, 'storageConditions')}
                                        className="form-control dist-input"
                                        placeholder="e.g., 45-55%"
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Special Requirements</label>
                                    <input
                                        type="text"
                                        name="specialRequirements"
                                        value={newItem.storageConditions.specialRequirements}
                                        onChange={(e) => handleInputChange(e, 'storageConditions')}
                                        className="form-control dist-input"
                                        placeholder="e.g., Keep away from light"
                                    />
                                </div>

                                {/* Warehouse Location */}
                                <div className="col-md-4">
                                    <label className="form-label">Warehouse Address</label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={newItem.warehouseLocation.address}
                                        onChange={(e) => handleInputChange(e, 'warehouseLocation')}
                                        className="form-control dist-input"
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Section</label>
                                    <input
                                        type="text"
                                        name="section"
                                        value={newItem.warehouseLocation.section}
                                        onChange={(e) => handleInputChange(e, 'warehouseLocation')}
                                        className="form-control dist-input"
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Shelf</label>
                                    <input
                                        type="text"
                                        name="shelf"
                                        value={newItem.warehouseLocation.shelf}
                                        onChange={(e) => handleInputChange(e, 'warehouseLocation')}
                                        className="form-control dist-input"
                                        required
                                    />
                                </div>

                                {/* Shipping Details */}
                                <div className="col-md-4">
                                    <label className="form-label">Shipping Status</label>
                                    <select
                                        name="status"
                                        value={newItem.shippingDetails.status}
                                        onChange={(e) => handleInputChange(e, 'shippingDetails')}
                                        className="form-select dist-input"
                                        required
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="in-transit">In Transit</option>
                                        <option value="delivered">Delivered</option>
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Shipping Cost</label>
                                    <div className="input-group dist-input-group">
                                        <span className="input-group-text">₹</span>
                                        <input
                                            type="number"
                                            name="cost"
                                            value={newItem.shippingDetails.cost}
                                            onChange={(e) => handleInputChange(e, 'shippingDetails')}
                                            className="form-control dist-input"
                                            min="0"
                                            step="0.01"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Expected Delivery Date</label>
                                    <input
                                        type="date"
                                        name="expectedDeliveryDate"
                                        value={newItem.shippingDetails.expectedDeliveryDate}
                                        onChange={(e) => handleInputChange(e, 'shippingDetails')}
                                        className="form-control dist-input"
                                        required
                                    />
                                </div>

                                {/* Retailer Details */}
                                <div className="col-md-4">
                                    <label className="form-label">Distribute To Retailer</label>
                                    <select
                                        className="form-select dist-input"
                                        value={newItem.distributedToRetailer.retailerId}
                                        onChange={handleRetailerSelect}
                                    >
                                        <option value="">Select Retailer</option>
                                        {retailers.map(ret => (
                                            <option key={ret.walletAddress || ret._id} value={ret.walletAddress}>
                                                {ret.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Distribution Date</label>
                                    <input
                                        type="date"
                                        value={newItem.distributedToRetailer.distributionDate}
                                        onChange={(e) => handleInputChange(e, 'distributedToRetailer', 'distributionDate')}
                                        className="form-control dist-input"
                                    />
                                </div>

                                <div className="col-12">
                                    <button type="submit" className="dist-btn primary">
                                        {editingItem ? 'Update Item' : 'Add Item'}
                                    </button>
                                    {editingItem && (
                                        <button
                                            type="button"
                                            className="dist-btn info ms-2"
                                            onClick={() => {
                                                setEditingItem(null);
                                                setNewItem({
                                                    batchId: "",
                                                    productName: "",
                                                    receivedFromManufacturer: {
                                                        manufacturerId: "",
                                                        manufacturerName: "",
                                                        receiptDate: new Date().toISOString().split('T')[0]
                                                    },
                                                    distributedToRetailer: {
                                                        retailerId: "",
                                                        retailerName: "",
                                                        distributionDate: new Date().toISOString().split('T')[0]
                                                    },
                                                    storageConditions: {
                                                        temperature: "",
                                                        humidity: "",
                                                        specialRequirements: ""
                                                    },
                                                    warehouseLocation: {
                                                        address: "",
                                                        section: "",
                                                        shelf: ""
                                                    },
                                                    shippingDetails: {
                                                        status: "pending",
                                                        cost: "",
                                                        expectedDeliveryDate: new Date().toISOString().split('T')[0]
                                                    },
                                                    quantity: ""
                                                });
                                            }}
                                        >
                                            Cancel Edit
                                        </button>
                                    )}
                                </div>
                            </form>
                        ) : (
                            <div className="dist-alert">You have read-only access to distributor inventory.</div>
                        )}
                    </div>
                </div>

                {/* Incoming Retailer Orders Section */}
                {incomingOrders.length > 0 && (
                    <div className="dist-card table-card mb-4">
                        <div className="card-title-row">
                            <h5>Incoming Retailer Orders</h5>
                            <span className="badge beta">{incomingOrders.length} Pending</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table dist-table">
                                <thead>
                                    <tr>
                                        <th>Retailer</th>
                                        <th>Product</th>
                                        <th>Batch ID</th>
                                        <th>Quantity</th>
                                        <th>Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {incomingOrders.map(order => (
                                        <tr key={order._id}>
                                            <td>{order.retailerName || order.retailerId}</td>
                                            <td>{order.productName}</td>
                                            <td>{order.batchId}</td>
                                            <td>{order.quantity}</td>
                                            <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    className="dist-btn success slim me-2"
                                                    onClick={() => handleApproveOrder(order._id)}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    className="dist-btn danger slim"
                                                    onClick={() => handleRejectOrder(order._id)}
                                                >
                                                    Reject
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Pending Distributions Section */}
                {pendingDistributions.length > 0 && (
                    <div className="dist-card table-card mb-4">
                        <div className="card-title-row">
                            <h5>Pending Distributions</h5>
                            <span className="badge beta">{pendingDistributions.length} Pending</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table dist-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Batch ID</th>
                                        <th>Quantity</th>
                                        <th>Manufacturer</th>
                                        <th>Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingDistributions.map(req => (
                                        <tr key={req._id}>
                                            <td>{req.productName}</td>
                                            <td>{req.batchId}</td>
                                            <td>{req.quantity}</td>
                                            <td>{req.manufacturerName || req.manufacturerId}</td>
                                            <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    className="dist-btn success slim me-2"
                                                    onClick={() => handleApproveDistribution(req._id)}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    className="dist-btn danger slim"
                                                    onClick={() => handleRejectDistribution(req._id)}
                                                >
                                                    Reject
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="dist-card table-card">
                    <div className="card-title-row">
                        <h5>Distributor Inventory</h5>
                        <div className="table-legend">
                            <span className="legend-pill pending">Pending</span>
                            <span className="legend-pill transit">In Transit</span>
                            <span className="legend-pill delivered">Delivered</span>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table dist-table">
                            <thead>
                                <tr>
                                    <th>Product/Batch ID</th>
                                    <th>Product Name</th>
                                    <th>Quantity</th>
                                    <th>Manufacturer</th>
                                    <th>Receipt Date</th>
                                    <th>Storage Conditions</th>
                                    <th>Warehouse Location</th>
                                    <th>Shipping Status</th>
                                    <th>Cost</th>
                                    <th>Expected Delivery</th>
                                    <th>Retailer</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventory.map((item) => (
                                    <tr key={item._id}>
                                        <td>{item.batchId}</td>
                                        <td>{item.productName}</td>
                                        <td>{item.quantity}</td>
                                        <td>{item.receivedFromManufacturer?.manufacturerName || '-'}</td>
                                        <td>{item.receivedFromManufacturer?.receiptDate ?
                                            new Date(item.receivedFromManufacturer.receiptDate).toLocaleDateString() : '-'}</td>
                                        <td>
                                            <small>
                                                <div>Temp: {item.storageConditions?.temperature || '-'}</div>
                                                <div>Humidity: {item.storageConditions?.humidity || '-'}</div>
                                                {item.storageConditions?.specialRequirements &&
                                                    <div>Special: {item.storageConditions.specialRequirements}</div>}
                                            </small>
                                        </td>
                                        <td>
                                            <small>
                                                <div>{item.warehouseLocation?.address}</div>
                                                <div>Section: {item.warehouseLocation?.section}</div>
                                                <div>Shelf: {item.warehouseLocation?.shelf}</div>
                                            </small>
                                        </td>
                                        <td>
                                            <span className={`status-pill ${item.shippingDetails?.status || 'pending'}`}>
                                                {item.shippingDetails?.status || 'pending'}
                                            </span>
                                        </td>
                                        <td>₹{item.shippingDetails?.cost?.toFixed(2) || '-'}</td>
                                        <td>{item.shippingDetails?.expectedDeliveryDate ?
                                            new Date(item.shippingDetails.expectedDeliveryDate).toLocaleDateString() : '-'}</td>
                                        <td>
                                            {item.distributedToRetailer?.retailerName ? (
                                                <div>{item.distributedToRetailer.retailerName} ({item.distributedToRetailer.retailerId})</div>
                                            ) : item.reservedFor && item.reservedFor.orderId ? (
                                                <div>
                                                    <div>{item.reservedFor.retailerName || item.reservedFor.retailerId}</div>
                                                    <small className="muted-copy">Reserved: {item.reservedFor.quantity}</small>
                                                </div>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td className="actions-cell">
                                            {editable ? (
                                                <>
                                                    <button
                                                        onClick={() => handleEdit(item)}
                                                        className="dist-btn info slim"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item._id)}
                                                        className="dist-btn danger slim"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="muted-copy">Read-only</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {inventory.length === 0 && (
                                    <tr>
                                        <td colSpan="12" className="text-center">No inventory items found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div >
    );
}

export default DistributorInventory;