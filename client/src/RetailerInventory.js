import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import Web3 from "web3";
import axios from "axios";
import { canEdit } from './permissions';
import "./RetailerInventory.css";

function RetailerInventory() {
    const history = useHistory();
    const [currentaccount, setCurrentaccount] = useState("");
    const [inventory, setInventory] = useState([]);
    const [distributors, setDistributors] = useState([]);
    const [incomingShipments, setIncomingShipments] = useState([]);
    const [marketplaceItems, setMarketplaceItems] = useState([]);
    const [myOrders, setMyOrders] = useState([]);
    const [editingItem, setEditingItem] = useState(null);

    const [newItem, setNewItem] = useState({
        productId: "",
        productName: "",
        quantitySold: 0,
        quantityInStock: 0,
        receivedFrom: {
            distributorId: "",
            distributorName: "",
            receiveDate: new Date().toISOString().split('T')[0]
        },
        retailPrice: 0,
        batchNumber: "",
        status: "in-stock"
    });

    useEffect(() => {
        loadWeb3();
        loadInventory();
        loadDistributors();
        loadIncomingShipments();
        loadMarketplace();
        loadMyOrders();
    }, []);

    // SSE: refresh marketplace when distributor inventory or distribution events happen
    useEffect(() => {
        const esUrl = (axios.defaults.baseURL || 'http://localhost:5002') + '/api/events/stream';
        const evtSource = new EventSource(esUrl);

        evtSource.addEventListener('distributor_inventory_created', (e) => {
            try {
                loadMarketplace();
            } catch (err) { }
        });

        evtSource.addEventListener('distribution_approved', (e) => {
            try {
                loadMarketplace();
                loadIncomingShipments();
            } catch (err) { }
        });

        return () => evtSource.close();
    }, []);

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
    };

    const loadDistributors = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const usersPromise = axios.get(`${base}/api/users?role=DIS`);
            const partsPromise = axios.get(`${base}/api/participants?role=DIS`);
            const [usersRes, partsRes] = await Promise.allSettled([usersPromise, partsPromise]);
            const users = usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : [];
            const parts = partsRes.status === 'fulfilled' ? (partsRes.value.data || []) : [];

            const map = new Map();
            users.forEach(u => {
                const addr = (u.walletAddress || '').toString().toLowerCase();
                if (addr) map.set(addr, { _id: u._id, name: u.name, walletAddress: u.walletAddress });
            });
            parts.forEach(p => {
                const addr = (p.address || '').toString().toLowerCase();
                if (addr && !map.has(addr)) map.set(addr, { _id: p._id, name: p.name, walletAddress: p.address });
            });

            setDistributors(Array.from(map.values()));
        } catch (error) {
            console.error("Error loading distributors:", error);
        }
    };

    const loadInventory = async () => {
        try {
            const response = await axios.get("http://localhost:5002/api/retailer-inventory");
            setInventory(response.data);
        } catch (error) {
            console.error("Error loading inventory:", error);
        }
    };

    const loadIncomingShipments = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const response = await axios.get(`${base}/api/retailer/incoming`);
            // API returns shipments assigned to this retailer; filter out delivered
            setIncomingShipments(response.data.filter(item => item.shippingDetails?.status !== 'delivered'));
        } catch (error) {
            console.error("Error loading shipments:", error);
        }
    };

    const loadMarketplace = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const response = await axios.get(`${base}/api/distributor-inventory`);
            console.log('Marketplace API response:', response.data);
            const available = response.data.filter(item =>
                !item.distributedToRetailer || !item.distributedToRetailer.retailerId
            );
            setMarketplaceItems(available);
        } catch (error) {
            console.error("Error loading marketplace:", error.response || error.message || error);
        }
    };

    const loadMyOrders = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const response = await axios.get(`${base}/api/retailer-orders/retailer/my-orders`);
            setMyOrders(response.data);
        } catch (error) {
            console.error("Error loading my orders:", error);
        }
    };

    const getDistributorName = (address) => {
        if (!address) return '-';
        const addr = (address || '').toString().toLowerCase();
        const d = distributors.find(dv => {
            const cand = (dv.walletAddress || dv.address || dv.walletAddress || '').toString().toLowerCase();
            return cand === addr;
        });
        return (d && (d.name || d.walletAddress || d.address)) || address;
    };

    const handleOrderItem = async (item) => {
        const quantity = prompt(`Enter quantity to order (Max: ${item.quantity}):`, item.quantity);
        if (!quantity || quantity <= 0 || quantity > item.quantity) {
            alert("Invalid quantity");
            return;
        }

        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const res = await axios.post(`${base}/api/retailer-orders`, {
                distributorId: item.distributorId,
                inventoryItemId: item._id,
                productName: item.productName,
                batchId: item.batchId,
                quantity: parseInt(quantity),
                retailerName: currentaccount
            });
            const created = res.data;
            if (created.status === 'rejected') {
                alert('Order rejected: ' + (created.rejectionReason || 'Insufficient stock'));
            } else {
                alert("Order placed successfully!");
            }
            loadMyOrders();
            loadMarketplace();
        } catch (error) {
            console.error("Error placing order:", error);
            alert("Failed to place order. Please try again.");
        }
    };

    const handleReceiveShipment = async (shipment) => {
        if (!window.confirm(`Receive shipment of ${shipment.productName}?`)) return;

        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            // Use server-side accept endpoint which performs validation, creates retailer inventory,
            // updates distributor inventory, and records blockchain transfer.
            const res = await axios.post(`${base}/api/retailer/accept`, {
                distributionId: shipment._id
            });

            console.log('Accept shipment response:', res.data);
            alert(res.data?.message || 'Shipment received successfully!');
            loadInventory();
            loadIncomingShipments();
        } catch (error) {
            console.error("Error receiving shipment:", error.response || error.message || error);
            const serverMsg = error.response?.data?.error || error.response?.data?.message || error.message;
            alert("Failed to receive shipment: " + (serverMsg || 'Please try again'));
        }
    };

    const handleInputChange = (e, section = null) => {
        const { name, value } = e.target;

        if (section) {
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

    const handleDistributorSelect = (e) => {
        const val = (e.target.value || '').toLowerCase();
        const distributor = distributors.find(d => (d.walletAddress || '').toLowerCase() === val);
        if (distributor) {
            setNewItem(prev => ({
                ...prev,
                receivedFrom: {
                    ...prev.receivedFrom,
                    distributorId: distributor.walletAddress,
                    distributorName: distributor.name
                }
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await axios.patch(
                    `http://localhost:5002/api/retailer-inventory/${editingItem._id}`,
                    {
                        ...newItem,
                        retailerId: currentaccount
                    }
                );
            } else {
                await axios.post("http://localhost:5002/api/retailer-inventory", {
                    ...newItem,
                    retailerId: currentaccount
                });
            }

            setNewItem({
                productId: "",
                productName: "",
                quantitySold: 0,
                quantityInStock: 0,
                receivedFrom: {
                    distributorId: "",
                    distributorName: "",
                    receiveDate: new Date().toISOString().split('T')[0]
                },
                retailPrice: 0,
                batchNumber: "",
                status: "in-stock"
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
            receivedFrom: {
                ...item.receivedFrom,
                receiveDate: new Date(item.receivedFrom?.receiveDate || new Date()).toISOString().split('T')[0]
            }
        });
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this item?")) {
            try {
                await axios.delete(`http://localhost:5002/api/retailer-inventory/${id}`);
                loadInventory();
            } catch (error) {
                console.error("Error deleting item:", error);
                alert("Error deleting item. Please try again.");
            }
        }
    };

    const redirect_to_home = () => {
        history.push("/home");
    }

    const role = localStorage.getItem('userRole');
    const editable = canEdit('retailer', role);

    return (
        <div className="retail-page">
            <div className="retail-grid" aria-hidden="true" />
            <div className="retail-glow" aria-hidden="true" />
            <div className="retail-content">
                <div className="retail-header">
                    <div>
                        <p className="eyebrow">Retail Observation</p>
                        <h2>Retail Inventory</h2>
                        <p className="subcopy">
                            Monitor consumer-ready batches, align distributor feeds, and track sell-through in a cyber hub.
                        </p>
                        <p className="subcopy subtle"><b>Account:</b> {currentaccount || 'Loading wallet...'}</p>
                    </div>
                    <button onClick={redirect_to_home} className="retail-btn danger">
                        Back to Home
                    </button>
                </div>

                {/* Marketplace Section */}
                <div className="retail-card table-card mb-4">
                    <div className="card-title-row">
                        <h5>Marketplace (Available from Distributors)</h5>
                        <span className="badge beta">{marketplaceItems.length} Available</span>
                    </div>
                    <div className="table-responsive">
                        <table className="table retail-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Batch ID</th>
                                    <th>Quantity</th>
                                    <th>Distributor</th>
                                    <th>Price/Cost</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {marketplaceItems.map(item => {
                                    const reservedQty = item.reservedFor?.quantity || 0;
                                    const available = (item.quantity || 0) - reservedQty;
                                    const isReserved = reservedQty > 0;
                                    return (
                                        <tr key={item._id}>
                                            <td>{item.productName}</td>
                                            <td>{item.batchId}</td>
                                            <td>
                                                <div><strong>{available}</strong> available</div>
                                                {isReserved && (
                                                    <small className="muted-copy">(Reserved: {reservedQty})</small>
                                                )}
                                            </td>
                                            <td>{getDistributorName(item.distributorId)}</td>
                                            <td>₹{item.shippingDetails?.cost || '-'}</td>
                                            <td>
                                                <button
                                                    className="retail-btn primary slim"
                                                    onClick={() => handleOrderItem(item)}
                                                    disabled={available <= 0}
                                                >
                                                    {available > 0 ? 'Order' : 'Sold Out'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {marketplaceItems.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="text-center">No marketplace items available</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* My Orders Section */}
                {myOrders.length > 0 && (
                    <div className="retail-card table-card mb-4">
                        <div className="card-title-row">
                            <h5>My Orders</h5>
                            <span className="badge beta">{myOrders.length} Orders</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table retail-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Batch ID</th>
                                        <th>Quantity</th>
                                        <th>Distributor</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myOrders.map(order => (
                                        <tr key={order._id}>
                                            <td>{order.productName}</td>
                                            <td>{order.batchId}</td>
                                            <td>{order.quantity}</td>
                                                    <td>{getDistributorName(order.distributorId)}</td>
                                            <td>
                                                <span className={`status-pill ${order.status}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Incoming Shipments Section */}
                {incomingShipments.length > 0 && (
                    <div className="retail-card table-card mb-4">
                        <div className="card-title-row">
                            <h5>Incoming Shipments</h5>
                            <span className="badge beta">{incomingShipments.length} Arriving</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table retail-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Batch ID</th>
                                        <th>Quantity</th>
                                        <th>From Distributor</th>
                                        <th>Expected Date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {incomingShipments.map(shipment => (
                                        <tr key={shipment._id}>
                                            <td>{shipment.productName}</td>
                                            <td>{shipment.batchId}</td>
                                            <td>{shipment.quantity}</td>
                                            <td>{getDistributorName(shipment.distributorId)}</td>
                                            <td>{new Date(shipment.shippingDetails?.expectedDeliveryDate).toLocaleDateString()}</td>
                                            <td>
                                                <span className={`status-pill ${shipment.shippingDetails?.status}`}>
                                                    {shipment.shippingDetails?.status}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="retail-btn success slim"
                                                    onClick={() => handleReceiveShipment(shipment)}
                                                >
                                                    Receive
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="retail-card">
                    <div className="card-title-row">
                        <h5>{editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h5>
                        <span className="badge beta">Point-of-sale Sync</span>
                    </div>
                    <div className="card-body">
                        {editable ? (
                            <form onSubmit={handleSubmit} className="row g-3">
                                <div className="col-md-4">
                                    <label className="form-label">Product ID</label>
                                    <input
                                        type="text"
                                        name="productId"
                                        value={newItem.productId}
                                        onChange={handleInputChange}
                                        className="form-control retail-input"
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Product Name</label>
                                    <input
                                        type="text"
                                        name="productName"
                                        value={newItem.productName}
                                        onChange={handleInputChange}
                                        className="form-control retail-input"
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Batch Number</label>
                                    <input
                                        type="text"
                                        name="batchNumber"
                                        value={newItem.batchNumber}
                                        onChange={handleInputChange}
                                        className="form-control retail-input"
                                        required
                                    />
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label">Quantity In Stock</label>
                                    <input
                                        type="number"
                                        name="quantityInStock"
                                        value={newItem.quantityInStock}
                                        onChange={handleInputChange}
                                        className="form-control retail-input"
                                        min="0"
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Quantity Sold</label>
                                    <input
                                        type="number"
                                        name="quantitySold"
                                        value={newItem.quantitySold}
                                        onChange={handleInputChange}
                                        className="form-control retail-input"
                                        min="0"
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Retail Price (₹)</label>
                                    <div className="input-group retail-input-group">
                                        <span className="input-group-text">₹</span>
                                        <input
                                            type="number"
                                            name="retailPrice"
                                            value={newItem.retailPrice}
                                            onChange={handleInputChange}
                                            className="form-control retail-input"
                                            min="0"
                                            step="0.01"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label">Received From Distributor</label>
                                    <select
                                        className="form-select retail-input"
                                        value={newItem.receivedFrom.distributorId}
                                        onChange={handleDistributorSelect}
                                        required
                                    >
                                        <option value="">Select Distributor</option>
                                        {distributors.map(dist => (
                                            <option key={dist.address} value={dist.address}>
                                                {dist.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Receive Date</label>
                                    <input
                                        type="date"
                                        name="receiveDate"
                                        value={newItem.receivedFrom.receiveDate}
                                        onChange={(e) => handleInputChange(e, 'receivedFrom')}
                                        className="form-control retail-input"
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Status</label>
                                    <select
                                        name="status"
                                        value={newItem.status}
                                        onChange={handleInputChange}
                                        className="form-select retail-input"
                                        required
                                    >
                                        <option value="in-stock">In Stock</option>
                                        <option value="sold">Sold</option>
                                    </select>
                                </div>

                                <div className="col-12">
                                    <button type="submit" className="retail-btn primary">
                                        {editingItem ? 'Update Item' : 'Add Item'}
                                    </button>
                                    {editingItem && (
                                        <button
                                            type="button"
                                            className="retail-btn info ms-2"
                                            onClick={() => {
                                                setEditingItem(null);
                                                setNewItem({
                                                    productId: "",
                                                    productName: "",
                                                    quantitySold: 0,
                                                    quantityInStock: 0,
                                                    receivedFrom: {
                                                        distributorId: "",
                                                        distributorName: "",
                                                        receiveDate: new Date().toISOString().split('T')[0]
                                                    },
                                                    retailPrice: 0,
                                                    batchNumber: "",
                                                    status: "in-stock"
                                                });
                                            }}
                                        >
                                            Cancel Edit
                                        </button>
                                    )}
                                </div>
                            </form>
                        ) : (
                            <div className="retail-alert">You have read-only access to retailer inventory.</div>
                        )}
                    </div>
                </div>

                <div className="retail-card table-card">
                    <div className="card-title-row">
                        <h5>Retailer Inventory</h5>
                        <div className="table-legend">
                            <span className="legend-pill stock">In Stock</span>
                            <span className="legend-pill sold">Sold</span>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table retail-table">
                            <thead>
                                <tr>
                                    <th>Product ID</th>
                                    <th>Product Name</th>
                                    <th>Batch Number</th>
                                    <th>In Stock</th>
                                    <th>Sold</th>
                                    <th>Retail Price</th>
                                    <th>Manufacturer</th>
                                    <th>Receive Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventory.map((item) => (
                                    <tr key={item._id}>
                                        <td>{item.productId}</td>
                                        <td>{item.productName}</td>
                                        <td>{item.batchNumber}</td>
                                        <td>{item.quantityInStock}</td>
                                        <td>{item.quantitySold}</td>
                                        <td>₹{item.retailPrice?.toFixed(2)}</td>
                                        <td>{item.receivedFrom?.distributorName || '-'}</td>
                                        <td>{item.receivedFrom?.receiveDate ?
                                            new Date(item.receivedFrom.receiveDate).toLocaleDateString() : '-'}</td>
                                        <td>
                                            <span className={`status-pill ${item.status}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="retail-btn info slim"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item._id)}
                                                className="retail-btn danger slim"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {inventory.length === 0 && (
                                    <tr>
                                        <td colSpan="10" className="text-center">No inventory items found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RetailerInventory;
