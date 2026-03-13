import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import { Container, Table, Button, Form, Row, Col, Card, Modal } from 'react-bootstrap';
import Web3 from 'web3';
import CryptoJS from 'crypto-js';
import "./Manufacturing.css";

// ZKP utility functions
const generateZKProof = (challenge) => {
    const privateKey = localStorage.getItem('zkpPrivateKey');
    if (!privateKey) {
        throw new Error('No ZKP private key found');
    }

    // Simple implementation - in production use a proper ZKP library
    const proof = CryptoJS.SHA256(privateKey + challenge).toString();
    return proof;
};

function Manufacturing() {
    const history = useHistory();
    const [items, setItems] = useState([]);
    const [currentaccount, setCurrentaccount] = useState("");
    const [purchasedMaterials, setPurchasedMaterials] = useState([]);
    const [distributors, setDistributors] = useState([]);
    const [newItem, setNewItem] = useState({
        productName: '',
        batchId: '',
        pricePerUnit: '',
        quantity: '',
        manufacturer: '',
    });

    // Distribution modal state
    const [showDistributeModal, setShowDistributeModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [distributeForm, setDistributeForm] = useState({
        distributorId: '',
        quantity: ''
    });
    const [distributingId, setDistributingId] = useState(null);

    // storage requirements state are nested under newItem.storageRequirements
    useEffect(() => {
        // ensure storageRequirements exists on newItem
        setNewItem(prev => ({
            ...prev,
            storageRequirements: prev.storageRequirements || { temperature: '', humidity: '', specialRequirements: '' }
        }));
        // run only once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Initialize wallet + data
        (async () => {
            await loadWeb3();
            fetchItems();
            fetchDistributors();
            fetchPurchasedMaterials();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // load wallet/account for manufacturer so we can show purchased raw materials
    const loadWeb3 = async () => {
        try {
            if (window.ethereum) {
                window.web3 = new Web3(window.ethereum);
                await window.ethereum.enable();
            } else if (window.web3) {
                window.web3 = new Web3(window.web3.currentProvider);
            } else {
                // not fatal — some environments rely on token-based auth instead
                console.warn('No web3 provider detected');
                return;
            }
            const web3 = window.web3;
            const accounts = await web3.eth.getAccounts();
            setCurrentaccount(accounts[0]);
        } catch (err) {
            console.error('Error loading web3:', err);
        }
    };

    const fetchItems = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Authentication required. Please log in.');
                setLoading(false);
                return;
            }

            console.log('Fetching manufacturing items with token:', token);
            // Use global axios and ensure we have a backend base URL.
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const response = await axios.get(`${base}/api/manufacturing`);
            setItems(response.data);
            setError('');
            setLoading(false);
        } catch (err) {
            console.error('Error details:', err);
            if (err.response?.status === 403) {
                setError('Access denied. You do not have permission to view manufacturing items.');
            } else if (err.response?.status === 401) {
                setError('Authentication required. Please log in again.');
                // Redirect to login page or handle re-authentication
            } else {
                setError(
                    err.response
                        ? `Error: ${err.response.data.message || err.response.statusText}`
                        : 'Error: Unable to connect to the server. Please make sure the backend is running.'
                );
            }
            setLoading(false);
        }
    };

    const fetchDistributors = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            // Fetch users (which contain walletAddress) and participants (which may have address)
            const usersPromise = axios.get(`${base}/api/users?role=DIS`);
            const partsPromise = axios.get(`${base}/api/participants?role=DIS`);

            const [usersRes, partsRes] = await Promise.allSettled([usersPromise, partsPromise]);
            const users = usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : [];
            const parts = partsRes.status === 'fulfilled' ? (partsRes.value.data || []) : [];

            // Merge by normalized address (walletAddress or address) and remove duplicates
            const map = new Map();

            users.forEach(u => {
                const addr = (u.walletAddress || '').toString().toLowerCase();
                if (addr) {
                    map.set(addr, { _id: u._id, name: u.name, walletAddress: u.walletAddress });
                }
            });

            parts.forEach(p => {
                const addr = (p.address || '').toString().toLowerCase();
                if (addr && !map.has(addr)) {
                    map.set(addr, { _id: p._id, name: p.name, walletAddress: p.address });
                }
            });

            setDistributors(Array.from(map.values()));
        } catch (err) {
            console.error('Error fetching distributors:', err);
        }
    };

    const fetchPurchasedMaterials = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const resp = await axios.get(`${base}/api/rawmaterials`);
            const mats = resp.data || [];
            const addr = (localStorage.getItem('walletAddress') || currentaccount || '').toString().toLowerCase();
            const filtered = mats.filter(m => {
                const mAddr = (m.manufacturerAddress || '').toString().toLowerCase();
                return mAddr && addr && mAddr === addr;
            });
            setPurchasedMaterials(filtered);
        } catch (err) {
            console.error('Error fetching purchased raw materials:', err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewItem(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleStorageChange = (field, value) => {
        setNewItem(prev => ({
            ...prev,
            storageRequirements: {
                ...(prev.storageRequirements || {}),
                [field]: value
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const challenge = await requestZKPChallenge();
            const zkProof = generateZKProof(challenge); // You'll need to implement this

            const base = axios.defaults.baseURL || 'http://localhost:5002';
            // Build payload but do NOT allow client to set `manufacturer`.
            const payload = {
                ...newItem,
                zkp: {
                    proof: zkProof,
                    challenge,
                    publicKey: localStorage.getItem('zkpPublicKey')
                }
            };
            // Remove any manufacturer supplied by client to avoid spoofing; server will set it.
            if (payload.hasOwnProperty('manufacturer')) delete payload.manufacturer;

            await axios.post(`${base}/api/manufacturing`, payload);

            setNewItem({
                productName: '',
                batchId: '',
                pricePerUnit: '',
                quantity: '',
                manufacturer: '',
            });
            setError('');
            fetchItems();
        } catch (err) {
            console.error('Error details:', err);
            if (err.response?.status === 403) {
                setError('Access denied. You do not have permission to add manufacturing items.');
            } else if (err.response?.status === 401) {
                setError('Authentication required. Please log in again.');
                // Redirect to login page or handle re-authentication
            } else {
                setError(
                    err.response
                        ? `Error adding item: ${err.response.data.message || err.response.statusText}`
                        : 'Error: Unable to connect to the server. Please make sure the backend is running.'
                );
            }
        }
    };

    // Helper function to request a new ZKP challenge from the server
    const requestZKPChallenge = async () => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            const response = await axios.get(`${base}/api/zkp/challenge`);
            return response.data.challenge;
        } catch (err) {
            throw new Error('Failed to get ZKP challenge');
        }
    };

    const updateStatus = async (id, newStatus) => {
        try {
            const base = axios.defaults.baseURL || 'http://localhost:5002';
            await axios.patch(`${base}/api/manufacturing/${id}`, { status: newStatus });
            fetchItems();
        } catch (err) {
            setError('Error updating status');
        }
    };

    const handleDistributeClick = (item) => {
        setSelectedItem(item);
        setDistributeForm({ distributorId: '', quantity: '' });
        setShowDistributeModal(true);
    };

    const handleDistributeSubmit = async () => {
        try {
            if (!distributeForm.distributorId || !distributeForm.quantity) {
                setError('Please select a distributor and enter quantity');
                return;
            }

            const qty = parseInt(distributeForm.quantity);
            if (qty > selectedItem.quantity) {
                setError(`Quantity exceeds available (${selectedItem.quantity})`);
                return;
            }

            setDistributingId(selectedItem._id);
            const base = axios.defaults.baseURL || 'http://localhost:5002';

            await axios.post(
                `${base}/api/distribution-requests`,
                {
                    manufacturingId: selectedItem._id,
                    distributorId: distributeForm.distributorId,
                    quantity: qty
                }
            );

            setShowDistributeModal(false);
            setDistributingId(null);
            setError('');
            fetchItems();
        } catch (err) {
            console.error('Error creating distribution request:', err);
            setError(err.response?.data?.error || 'Failed to create distribution request');
        }
    };

    if (loading) return <div className="loading-state">Initializing manufacturing modules...</div>;
    if (error) return <div className="error-state">{error}</div>;

    return (
        <div className="manufacturing-page">
            <div className="mfg-grid" aria-hidden="true" />
            <div className="mfg-glow" aria-hidden="true" />
            <Container className="mt-4 manufacturing-content">
                <div className="mfg-header">
                    <div>
                        <p className="eyebrow">Manufacturing Command</p>
                        <h2>Manufacturing Inventory</h2>
                        <p className="subcopy">
                            Track every batch, deploy zero-knowledge handoffs, and trigger production milestones in real time.
                        </p>
                    </div>
                    <div className="header-actions">
                        <div className="status-chip">
                            <span>{items.length}</span>
                            <p>Active Batches</p>
                        </div>
                        <button onClick={() => history.push('/home')} className="mfg-btn back-home">
                            ← Back to Home
                        </button>
                    </div>
                </div>

                <Card className="mb-4 neon-card">
                    <Card.Body>
                        <div className="card-title-row">
                            <h4>Add New Manufacturing Item</h4>
                            <span className="badge beta">ZKP Protected</span>
                        </div>
                        <Form onSubmit={handleSubmit}>
                            <Row>
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Product Name</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="productName"
                                            value={newItem.productName}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Batch ID</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="batchId"
                                            value={newItem.batchId}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Price Per Unit</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="pricePerUnit"
                                            value={newItem.pricePerUnit}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Quantity</Form.Label>
                                        <Form.Control
                                            type="number"
                                            name="quantity"
                                            value={newItem.quantity}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Manufacturer (auto)</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="manufacturer"
                                            value={newItem.manufacturer}
                                            onChange={handleInputChange}
                                            placeholder="Your wallet address will be used"
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Row>
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Temperature Requirements</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="storageTemperature"
                                            value={newItem.storageRequirements?.temperature || ''}
                                            onChange={(e) => handleStorageChange('temperature', e.target.value)}
                                            placeholder="e.g., 2-8°C"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Humidity Requirements</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="storageHumidity"
                                            value={newItem.storageRequirements?.humidity || ''}
                                            onChange={(e) => handleStorageChange('humidity', e.target.value)}
                                            placeholder="e.g., 45-55%"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Special Requirements</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="storageSpecial"
                                            value={newItem.storageRequirements?.specialRequirements || ''}
                                            onChange={(e) => handleStorageChange('specialRequirements', e.target.value)}
                                            placeholder="e.g., Keep away from sunlight"
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Button type="submit" className="mfg-btn primary">Add Item</Button>
                        </Form>
                    </Card.Body>
                </Card>

                <div className="table-wrapper">
                    <Table striped responsive bordered hover className="neon-table">
                        <thead>
                            <tr>
                                <th>Product Name</th>
                                <th>Batch ID</th>
                                <th>Storage</th>
                                <th>Production Date</th>
                                <th>Price Per Unit</th>
                                <th>Quantity</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item._id}>
                                    <td>{item.productName}</td>
                                    <td>{item.batchId}</td>
                                    <td>
                                        {item.storageRequirements ? (
                                            <div className="storage-block">
                                                {item.storageRequirements.temperature && <div>Temp: {item.storageRequirements.temperature}</div>}
                                                {item.storageRequirements.humidity && <div>Humidity: {item.storageRequirements.humidity}</div>}
                                                {item.storageRequirements.specialRequirements && <div>Note: {item.storageRequirements.specialRequirements}</div>}
                                            </div>
                                        ) : (
                                            <span className="muted-copy">—</span>
                                        )}
                                    </td>
                                    <td>{new Date(item.productionDate).toLocaleDateString()}</td>
                                    <td>${item.pricePerUnit}</td>
                                    <td>{item.quantity}</td>
                                    <td>
                                        <span className={`status-pill ${item.status}`}>
                                            {item.status.replace('-', ' ')}
                                        </span>
                                    </td>
                                    <td>
                                        {item.status === 'in-production' && (
                                            <Button
                                                size="sm"
                                                className="mfg-btn success"
                                                onClick={() => updateStatus(item._id, 'completed')}
                                            >
                                                Mark Completed
                                            </Button>
                                        )}
                                        {item.status === 'completed' && (
                                            <Button
                                                size="sm"
                                                className="mfg-btn info"
                                                onClick={() => handleDistributeClick(item)}
                                                disabled={distributingId === item._id}
                                            >
                                                {distributingId === item._id ? 'Distributing...' : 'Distribute'}
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>

                {/* Purchased Raw Materials Table for this Manufacturer */}
                <Card className="mt-4 neon-card">
                    <Card.Body>
                        <div className="card-title-row">
                            <h4>Purchased Raw Materials</h4>
                            <span className="badge beta">From Suppliers</span>
                        </div>
                        <div className="table-wrapper">
                            <Table striped responsive bordered hover className="neon-table">
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Quantity</th>
                                        <th>Unit</th>
                                        <th>Price/Unit</th>
                                        <th>Supplier</th>
                                        <th>Purchased At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchasedMaterials.length > 0 ? (
                                        purchasedMaterials.map(mat => (
                                            <tr key={mat._id}>
                                                <td>{mat.type}</td>
                                                <td>{mat.requestedQuantity && mat.requestedQuantity > 0 ? mat.requestedQuantity : mat.quantity}</td>
                                                <td>{mat.unit}</td>
                                                <td>{mat.pricePerUnit ? `$${mat.pricePerUnit}` : '—'}</td>
                                                <td>
                                                    {mat.addedByName ? (
                                                        <div>
                                                            <div style={{ fontWeight: 700 }}>{mat.addedByName}</div>
                                                            <div style={{ fontSize: '0.85em', color: '#888' }}>{mat.addedByAddress || (mat.addedBy ? `${mat.addedBy.substring(0, 8)}...${mat.addedBy.substring(mat.addedBy.length - 6)}` : '')}</div>
                                                        </div>
                                                    ) : (
                                                        mat.addedBy ? `${mat.addedBy.substring(0, 8)}...${mat.addedBy.substring(mat.addedBy.length - 6)}` : '—'
                                                    )}
                                                </td>
                                                <td>{new Date(mat.timestamp).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="text-center">No purchased raw materials found for your account.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </Card.Body>
                </Card>
            </Container>

            {/* Distribution Modal */}
            <Modal show={showDistributeModal} onHide={() => setShowDistributeModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Distribute to Distributor</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedItem && (
                        <div>
                            <p><strong>Product:</strong> {selectedItem.productName}</p>
                            <p><strong>Batch ID:</strong> {selectedItem.batchId}</p>
                            <p><strong>Available Quantity:</strong> {selectedItem.quantity}</p>

                            <Form.Group className="mb-3">
                                <Form.Label>Select Distributor</Form.Label>
                                <Form.Control
                                    as="select"
                                    value={distributeForm.distributorId}
                                    onChange={(e) => setDistributeForm({ ...distributeForm, distributorId: e.target.value })}
                                >
                                    <option value="">-- Choose a Distributor --</option>
                                    {distributors.map(dist => (
                                        <option key={dist._id} value={dist.walletAddress || dist.address || dist._id}>
                                            {dist.name} ({dist.walletAddress || dist.address || dist._id})
                                        </option>
                                    ))}
                                </Form.Control>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>Quantity to Distribute</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="1"
                                    max={selectedItem.quantity}
                                    value={distributeForm.quantity}
                                    onChange={(e) => setDistributeForm({ ...distributeForm, quantity: e.target.value })}
                                    placeholder="Enter quantity"
                                />
                            </Form.Group>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDistributeModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleDistributeSubmit}>
                        Send Distribution Request
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default Manufacturing;