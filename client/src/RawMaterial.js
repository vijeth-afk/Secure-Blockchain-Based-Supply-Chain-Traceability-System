import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import Web3 from "web3";
import axios from "axios";
import { canEdit } from './permissions';
import "./RawMaterial.css";

function RawMaterial() {
    const history = useHistory();
    const [currentaccount, setCurrentaccount] = useState("");
    const [rawMaterials, setRawMaterials] = useState([]);
    const [newMaterial, setNewMaterial] = useState({
        type: "",
        quantity: "",
        unit: "kg",
        pricePerUnit: "",
    });
    const [editMaterialId, setEditMaterialId] = useState(null);
    const [manufacturerName, setManufacturerName] = useState("");
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [requestQuantity, setRequestQuantity] = useState("");
    const [requestTemp, setRequestTemp] = useState("");
    const [requestHumidity, setRequestHumidity] = useState("");
    const [requestSpecial, setRequestSpecial] = useState("");

    useEffect(() => {
        loadWeb3();
        loadMaterials();
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

    const loadMaterials = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            console.log('Loading materials from:', `${base}/api/rawmaterials`);
            console.log('Auth header:', axios.defaults.headers.common['Authorization']);

            const response = await axios.get(`${base}/api/rawmaterials`);
            console.log('Materials loaded:', response.data.length, 'items');
            setRawMaterials(response.data);
        } catch (error) {
            console.error("Error loading materials:", error);
            console.error("Error response:", error.response?.data);
            console.error("Error status:", error.response?.status);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewMaterial((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate that wallet is loaded
        if (!currentaccount) {
            alert("Please wait for your wallet to connect before adding materials.");
            return;
        }

        try {
            if (editMaterialId) {
                // Update existing material
                const base = axios.defaults.baseURL || 'http://localhost:5002';
                console.log('Updating material:', editMaterialId);
                await axios.put(`${base}/api/rawmaterials/${editMaterialId}`, {
                    ...newMaterial,
                    quantity: Number(newMaterial.quantity),
                    pricePerUnit: Number(newMaterial.pricePerUnit),
                });
                setEditMaterialId(null);
            } else {
                // Add new material
                const base = axios.defaults.baseURL || 'http://localhost:5002';
                const payload = {
                    ...newMaterial,
                    quantity: Number(newMaterial.quantity),
                    pricePerUnit: Number(newMaterial.pricePerUnit),
                    addedBy: currentaccount,
                    timestamp: new Date(),
                };
                console.log('Adding new material:', payload);
                console.log('Auth header:', axios.defaults.headers.common['Authorization']);

                const response = await axios.post(`${base}/api/rawmaterials`, payload);
                console.log('Material added successfully:', response.data);
            }
            setNewMaterial({ type: "", quantity: "", unit: "kg", pricePerUnit: "" });
            loadMaterials();
        } catch (error) {
            console.error("Error adding/updating material:", error);
            console.error("Error response:", error.response?.data);
            console.error("Error status:", error.response?.status);
            const errorMessage = error.response?.data?.message || error.message || "Unknown error";
            alert(`Error adding/updating material: ${errorMessage}\n\nPlease check:\n1. You are logged in as a Supplier\n2. All fields are filled correctly\n3. Your wallet is connected`);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this material?")) return;
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            await axios.delete(`${base}/api/rawmaterials/${id}`);
            loadMaterials();
        } catch (error) {
            console.error("Error deleting material:", error);
        }
    };

    const handleEdit = (material) => {
        setEditMaterialId(material._id);
        setNewMaterial({
            type: material.type,
            quantity: material.quantity,
            unit: material.unit,
            pricePerUnit: material.pricePerUnit,
        });
    };

    const handleSell = async (id) => {
        const name = prompt("Enter Manufacturer Name:");
        if (!name) return;
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            await axios.patch(`${base}/api/rawmaterials/${id}/sell`, {
                manufacturerName: name,
                sold: true,
            });
            setManufacturerName(name);
            loadMaterials();
        } catch (error) {
            console.error("Error marking as sold:", error);
            alert("Error updating sale status.");
        }
    };

    // Supplier responds to a manufacturer's request: accept (optionally mark sold) or reject
    const handleRespond = async (id, action, markSold = false, manuName = '', manuAddress = '') => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            await axios.patch(`${base}/api/rawmaterials/${id}/respond`, { action, markSold, manufacturerName: manuName, manufacturerAddress: manuAddress });
            loadMaterials();
        } catch (err) {
            console.error('Error responding to request:', err);
            alert('Error responding to request.');
        }
    };

    // helper to get requester identity (used when marking sold) returning {name, address}
    const materialRequesterInfo = (id) => {
        const mat = rawMaterials.find(m => m._id === id);
        if (!mat) return { name: '', address: '' };
        return { name: mat.requesterName || mat.manufacturerName || '', address: mat.requestedBy || mat.manufacturerAddress || '' };
    };

    // Manufacturer requests verification of a raw material batch with quantity
    const handleRequest = async (id) => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            await axios.patch(`${base}/api/rawmaterials/${id}/verify`, {
                action: 'request',
                requestedQuantity: Number(requestQuantity),
                requestedStorage: {
                    temperature: requestTemp,
                    humidity: requestHumidity,
                    specialRequirements: requestSpecial
                }
            });
            setShowQuantityModal(false);
            setRequestQuantity('');
            setRequestTemp('');
            setRequestHumidity('');
            setRequestSpecial('');
            setSelectedMaterial(null);
            loadMaterials();
        } catch (err) {
            console.error('Error requesting verification of material:', err);
            alert(err.response?.data?.message || 'Error sending request.');
        }
    };

    const openRequestModal = (material) => {
        setSelectedMaterial(material);
        setShowQuantityModal(true);
    };

    const redirect_to_home = () => {
        history.push("/home");
    };

    const role = localStorage.getItem('userRole');
    const editable = canEdit('rawmaterials', role);

    return (
        <div className="raw-page">
            <div className="raw-grid" aria-hidden="true" />
            <div className="raw-glow" aria-hidden="true" />
            <div className="raw-content">
                <div className="raw-header">
                    <div>
                        <p className="eyebrow">Raw Material</p>
                        <h2>Supply Inputs Dashboard</h2>
                        <p className="subcopy">
                            Verify provenance, approve requests, and allocate batches across manufacturers with ZK-enabled oversight.
                        </p>
                        <p className="subcopy subtle"><b>Current Account:</b> {currentaccount || 'Loading wallet...'}</p>
                    </div>
                    <button onClick={redirect_to_home} className="raw-btn danger">
                        Back to Home
                    </button>
                </div>

                <div className="raw-card">
                    <div className="card-title-row">
                        <h5>{editMaterialId ? "Update Material" : "Add Raw Material"}</h5>
                        <span className="badge beta">Live Feed</span>
                    </div>
                    <div className="card-body">
                        {editable ? (
                            <form onSubmit={handleSubmit}>
                                <div className="row g-3">
                                    <div className="col-md-3">
                                        <input
                                            type="text"
                                            name="type"
                                            value={newMaterial.type}
                                            onChange={handleInputChange}
                                            className="form-control raw-input"
                                            placeholder="Material Type"
                                            required
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <input
                                            type="number"
                                            name="quantity"
                                            value={newMaterial.quantity}
                                            onChange={handleInputChange}
                                            className="form-control raw-input"
                                            placeholder="Quantity"
                                            min="0"
                                            step="0.01"
                                            required
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <select
                                            name="unit"
                                            value={newMaterial.unit}
                                            onChange={handleInputChange}
                                            className="form-control raw-input"
                                        >
                                            <option value="kg">kg</option>
                                            <option value="g">g</option>
                                            <option value="l">L</option>
                                            <option value="ml">ml</option>
                                            <option value="pcs">pcs</option>
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="input-group raw-input-group">
                                            <span className="input-group-text">₹</span>
                                            <input
                                                type="number"
                                                name="pricePerUnit"
                                                value={newMaterial.pricePerUnit}
                                                onChange={handleInputChange}
                                                className="form-control raw-input"
                                                placeholder="Price per unit"
                                                min="0"
                                                step="0.01"
                                                required
                                            />
                                            <span className="input-group-text">/{newMaterial.unit}</span>
                                        </div>
                                    </div>
                                    <div className="col-md-2">
                                        <button type="submit" className="raw-btn success w-100">
                                            {editMaterialId ? "Update" : "Add"}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <div className="raw-alert">You have read-only access to raw materials.</div>
                        )}
                    </div>
                </div>

                <div className="raw-card table-card">
                    <div className="card-title-row">
                        <h5>Raw Materials Inventory</h5>
                        <div className="table-legend">
                            <span className="legend-pill pending">Pending</span>
                            <span className="legend-pill approved">Approved</span>
                            <span className="legend-pill rejected">Rejected</span>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table raw-table align-middle">
                            <thead>
                                <tr>
                                    <th>Material Type</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
                                    <th>Price/Unit (₹)</th>
                                    <th>Added By</th>
                                    <th>Status</th>
                                    <th>Requested By</th>
                                    <th>Manufacturer</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rawMaterials.length > 0 ? (
                                    rawMaterials.map((material) => (
                                        <tr key={material._id}>
                                            <td>{material.type}</td>
                                            <td>{material.quantity}</td>
                                            <td>{material.unit}</td>
                                            <td>{material.pricePerUnit ? `₹${material.pricePerUnit}` : "—"}</td>
                                            <td>
                                                {material.addedByName ? (
                                                    <div>
                                                        <div style={{ fontWeight: 700 }}>{material.addedByName}</div>
                                                        <div style={{ fontSize: '0.85em', color: '#888' }}>{material.addedByAddress ? `${material.addedByAddress.substring(0, 6)}...${material.addedByAddress.substring(Math.max(material.addedByAddress.length - 6, 6))}` : (material.addedBy ? `${material.addedBy.substring(0,6)}...` : 'N/A')}</div>
                                                    </div>
                                                ) : material.addedBy ? (
                                                    `${material.addedBy.substring(0, 6)}...${material.addedBy.substring(Math.max(material.addedBy.length - 6, 6))}`
                                                ) : (
                                                    "N/A"
                                                )}
                                            </td>
                                            <td>
                                                {material.status === 'approved' ? (
                                                    <span className="status-pill approved">Approved</span>
                                                ) : material.status === 'rejected' ? (
                                                    <span className="status-pill rejected">Rejected</span>
                                                ) : material.status === 'requested' ? (
                                                    <span className="status-pill requested">Requested</span>
                                                ) : (
                                                    <span className="status-pill pending">Pending</span>
                                                )}
                                            </td>
                                            <td>
                                                {material.requesterName ? (
                                                    <div className="requester-block">
                                                        <div className="requester-header">Requested By</div>
                                                        <div className="requester-divider" />
                                                        <div className="requester-name"><strong>{material.requesterName}</strong></div>
                                                        <div className="requester-email">{material.requesterEmail || material.requestedBy?.substring(0, 10) + '...'}</div>
                                                        {material.requestedQuantity > 0 && (
                                                            <div className="requester-qty">Qty: {material.requestedQuantity} {material.unit}</div>
                                                        )}
                                                        {material.requestedStorage?.temperature && (
                                                            <div className="requester-meta">Temp: {material.requestedStorage.temperature}</div>
                                                        )}
                                                        {material.requestedStorage?.humidity && (
                                                            <div className="requester-meta">Humidity: {material.requestedStorage.humidity}</div>
                                                        )}
                                                        {material.requestedStorage?.specialRequirements && (
                                                            <div className="requester-meta">Note: {material.requestedStorage.specialRequirements}</div>
                                                        )}
                                                    </div>
                                                ) : material.requestedBy ? (
                                                    `${material.requestedBy.substring(0, 6)}...${material.requestedBy.substring(38)}`
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td>
                                                {material.manufacturerName ? (
                                                    <div>
                                                        <div><strong>{material.manufacturerName}</strong></div>
                                                        {material.manufacturerAddress && (
                                                            <div style={{ fontSize: '0.85em', color: '#888' }}>{material.manufacturerAddress.substring(0, 8)}...{material.manufacturerAddress.substring(material.manufacturerAddress.length - 6)}</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="actions-cell">
                                                {editable ? (
                                                    <>
                                                        {role === 'SUP' && material.status === 'requested' ? (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        const info = materialRequesterInfo(material._id);
                                                                        handleRespond(material._id, 'accept', true, info.name, info.address);
                                                                    }}
                                                                    className="raw-btn success slim"
                                                                >
                                                                    Accept & Sold
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRespond(material._id, 'reject')}
                                                                    className="raw-btn danger slim"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {!material.sold && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleSell(material._id)}
                                                                            className="raw-btn success slim"
                                                                        >
                                                                            Sold
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleEdit(material)}
                                                                            className="raw-btn info slim"
                                                                        >
                                                                            Update
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDelete(material._id)}
                                                                    className="raw-btn danger slim"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </>
                                                        )}
                                                    </>
                                                ) : (
                                                    role === 'MAN' ? (
                                                        material.status === 'pending' ? (
                                                            <button
                                                                onClick={() => openRequestModal(material)}
                                                                className="raw-btn primary slim"
                                                            >
                                                                Request
                                                            </button>
                                                        ) : material.status === 'requested' ? (
                                                            <span className="status-pill requested">Requested</span>
                                                        ) : (
                                                            <span className="muted-copy">Read-only</span>
                                                        )
                                                    ) : (
                                                        <span className="muted-copy">Read-only</span>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="9" className="text-center">
                                            No materials added yet
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {showQuantityModal && selectedMaterial && (
                <div className="modal-overlay" onClick={() => setShowQuantityModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h4>Request Raw Material</h4>
                        <p><strong>Material:</strong> {selectedMaterial.type}</p>
                        <p><strong>Available:</strong> {selectedMaterial.quantity} {selectedMaterial.unit}</p>
                        <p><strong>Price:</strong> ₹{selectedMaterial.pricePerUnit}/{selectedMaterial.unit}</p>

                        <div className="form-group">
                            <label>Quantity Needed:</label>
                            <input
                                type="number"
                                className="form-control raw-input"
                                value={requestQuantity}
                                onChange={(e) => setRequestQuantity(e.target.value)}
                                min="0.01"
                                max={selectedMaterial.quantity}
                                step="0.01"
                                placeholder={`Max: ${selectedMaterial.quantity}`}
                                autoFocus
                            />
                            <small>Unit: {selectedMaterial.unit}</small>
                        </div>

                        <div className="form-group">
                            <label>Temperature Requirements (e.g., 2-8°C)</label>
                            <input
                                type="text"
                                className="form-control raw-input"
                                value={requestTemp}
                                onChange={(e) => setRequestTemp(e.target.value)}
                                placeholder="e.g., 2-8°C"
                            />
                        </div>
                        <div className="form-group">
                            <label>Humidity Requirements (e.g., 45-55%)</label>
                            <input
                                type="text"
                                className="form-control raw-input"
                                value={requestHumidity}
                                onChange={(e) => setRequestHumidity(e.target.value)}
                                placeholder="e.g., 45-55%"
                            />
                        </div>
                        <div className="form-group">
                            <label>Special Requirements</label>
                            <input
                                type="text"
                                className="form-control raw-input"
                                value={requestSpecial}
                                onChange={(e) => setRequestSpecial(e.target.value)}
                                placeholder="e.g., Keep away from sunlight"
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                className="raw-btn success"
                                onClick={() => handleRequest(selectedMaterial._id)}
                                disabled={!requestQuantity || requestQuantity <= 0 || Number(requestQuantity) > selectedMaterial.quantity}
                            >
                                Submit Request
                            </button>
                            <button
                                className="raw-btn danger"
                                onClick={() => {
                                    setShowQuantityModal(false);
                                    setRequestQuantity('');
                                    setSelectedMaterial(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RawMaterial;
