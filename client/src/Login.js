import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import Web3 from 'web3';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { Container, Row, Col, Card, Form, Button, Tab, Tabs, Alert } from 'react-bootstrap';
import AssignRoles from './AssignRoles';
import "./Login.css";

function Login() {
    const history = useHistory();
    const [currentaccount, setCurrentaccount] = useState('');
    const [loginError, setLoginError] = useState('');
    const [registerError, setRegisterError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'MAN', // Default role
        walletAddress: '' // optional explicit wallet address to register
    });
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        loadWeb3();
        // Clear any existing auth data
        localStorage.clear();
    }, []);

    const loadWeb3 = async () => {
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            try {
                await window.ethereum.enable();
                const web3 = window.web3;
                const accounts = await web3.eth.getAccounts();
                setCurrentaccount(accounts[0]);
            } catch (error) {
                console.error("User denied account access");
            }
        } else if (window.web3) {
            window.web3 = new Web3(window.web3.currentProvider);
        } else {
            window.alert('Non-Ethereum browser detected. Please install MetaMask!');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const generateZKPKeys = () => {
        // In a production environment, use a proper cryptographic library
        const privateKey = CryptoJS.SHA256(Date.now().toString() + Math.random().toString()).toString();
        const publicKey = CryptoJS.SHA256(privateKey).toString();
        return { privateKey, publicKey };
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');

        try {
            // Determine which wallet address to use: explicit form value or connected MetaMask
            const walletToUse = formData.walletAddress && formData.walletAddress.trim() ? formData.walletAddress.trim() : currentaccount;

            if (!walletToUse) {
                setLoginError('Please connect your MetaMask wallet or enter your Ethereum address');
                return;
            }

            // basic ethereum address validation
            const ethRegex = /^0x[a-fA-F0-9]{40}$/;
            if (!ethRegex.test(walletToUse)) {
                setLoginError('Invalid Ethereum address. It should begin with 0x followed by 40 hex chars');
                return;
            }

            console.log('Attempting login with:', {
                email: formData.email,
                walletAddress: walletToUse
            });

            const response = await axios.post('http://localhost:5002/api/auth/login', {
                email: formData.email,
                password: formData.password,
                walletAddress: walletToUse
            });

            console.log('Login response:', response.data);

            if (response.data.success) {
                localStorage.clear(); // Clear any old data

                // Generate and store ZKP keys
                const zkpKeys = generateZKPKeys();
                localStorage.setItem('zkpPrivateKey', zkpKeys.privateKey);
                localStorage.setItem('zkpPublicKey', zkpKeys.publicKey);

                // Store new authentication data
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('userRole', response.data.role);
                localStorage.setItem('userName', response.data.name);
                // store the wallet we used for login
                const usedWallet = formData.walletAddress && formData.walletAddress.trim() ? formData.walletAddress.trim() : currentaccount;
                localStorage.setItem('walletAddress', usedWallet);
                // configure axios to use the token for subsequent requests
                axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

                setSuccessMessage('Login successful! Redirecting...');
                setTimeout(() => {
                    history.push('/home');
                }, 1500);
            } else {
                setLoginError(response.data.message || 'Login failed: Invalid response from server');
            }
        } catch (error) {
            console.error('Login error:', error);
            if (error.response) {
                console.log('Error response:', error.response.data);
                setLoginError(error.response.data.message || 'Invalid credentials');
            } else if (error.request) {
                setLoginError('Network error: Unable to reach the server');
            } else {
                setLoginError('An unexpected error occurred');
            }
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setRegisterError('');
        setSuccessMessage('');

        try {
            // Check if MetaMask is connected
            if (!currentaccount) {
                // allow registration if user provided a walletAddress in the form
                if (!formData.walletAddress || !formData.walletAddress.trim()) {
                    setRegisterError('Please connect your MetaMask wallet or enter an Ethereum address');
                    return;
                }
            }

            // Basic validation
            if (!formData.name.trim()) {
                setRegisterError('Name is required');
                return;
            }

            if (!formData.email.trim()) {
                setRegisterError('Email is required');
                return;
            }

            if (formData.password.length < 6) {
                setRegisterError('Password must be at least 6 characters long');
                return;
            }

            console.log('Attempting registration with:', {
                name: formData.name,
                email: formData.email,
                role: formData.role,
                walletAddress: formData.walletAddress && formData.walletAddress.trim() ? formData.walletAddress.trim() : currentaccount
            });

            // Choose provided wallet address if present, else use connected MetaMask account
            const walletToUse = formData.walletAddress && formData.walletAddress.trim() ? formData.walletAddress.trim() : currentaccount;

            // basic ethereum address validation
            const ethRegex = /^0x[a-fA-F0-9]{40}$/;
            if (!ethRegex.test(walletToUse)) {
                setRegisterError('Invalid Ethereum address. It should begin with 0x followed by 40 hex chars');
                return;
            }

            const response = await axios.post('http://localhost:5002/api/auth/register', {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                walletAddress: walletToUse
            });

            console.log('Registration response:', response.data);

            if (response.data.success) {
                // Generate and store ZKP keys for the new user
                const zkpKeys = generateZKPKeys();
                localStorage.setItem('zkpPrivateKey', zkpKeys.privateKey);
                localStorage.setItem('zkpPublicKey', zkpKeys.publicKey);

                setSuccessMessage('Registration successful! Please login.');
                // Clear form
                setFormData({
                    name: '',
                    email: '',
                    password: '',
                    role: 'MAN',
                    walletAddress: ''
                });
                // Switch to login tab after 2 seconds
                setTimeout(() => {
                    document.querySelector('button[data-rr-ui-event-key="login"]').click();
                }, 2000);
            }
        } catch (error) {
            console.error('Registration error:', error);
            if (error.response) {
                console.log('Error response:', error.response.data);
                setRegisterError(error.response.data.message || 'Registration failed');
            } else if (error.request) {
                setRegisterError('Network error: Unable to reach the server');
            } else {
                setRegisterError('An unexpected error occurred');
            }
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <div className="login-page">
            <div className="login-grid" aria-hidden="true" />
            <div className="login-glow" aria-hidden="true" />
            <Container className="login-shell">
                {successMessage && (
                    <Alert variant="success" className="login-alert" onClose={() => setSuccessMessage('')} dismissible>
                        {successMessage}
                    </Alert>
                )}

                <Row className="justify-content-center">
                    <Col md={9} lg={8}>
                        <Card className="login-card">
                            <Card.Header className="login-card-header">
                        
                                <h3 className="text-center">Secure Blockchain - Based Supply Chain Traceability System</h3>
                                <p className="subcopy">
                                    Authenticate, register stakeholders, and sync zero-knowledge credentials.
                                </p>
                            </Card.Header>
                            <Card.Body>
                                <Tabs defaultActiveKey="login" className="login-tabs mb-3" justify>
                                    <Tab eventKey="login" title="Login">
                                        <Form onSubmit={handleLogin} className="login-form">
                                            {loginError && (
                                                <Alert variant="danger" className="login-alert inline">
                                                    {loginError}
                                                </Alert>
                                            )}
                                            <Form.Group className="mb-3">
                                                <Form.Label>Email address</Form.Label>
                                                <Form.Control
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    required
                                                />
                                            </Form.Group>

                                            <Form.Group className="mb-3">
                                                <Form.Label>Password</Form.Label>
                                                <div className="password-field" style={{ display: 'flex', alignItems: 'center' }}>
                                                    <Form.Control
                                                        type={showPassword ? "text" : "password"}
                                                        name="password"
                                                        value={formData.password}
                                                        onChange={handleInputChange}
                                                        required
                                                        style={{ flex: 1 }}
                                                    />
                                                    <Button
                                                        variant="outline-secondary"
                                                        className="password-toggle"
                                                        onClick={togglePasswordVisibility}
                                                        style={{ marginLeft: '10px' }}
                                                    >
                                                        {showPassword ? "Hide" : "Show"}
                                                    </Button>
                                                </div>
                                            </Form.Group>

                                            <Form.Group className="mb-3">
                                                <Form.Label>Ethereum Address</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="walletAddress"
                                                    value={formData.walletAddress}
                                                    onChange={handleInputChange}
                                                    placeholder="0x... or leave empty to use connected MetaMask wallet"
                                                />
                                            </Form.Group>

                                            <div className="d-grid">
                                                <Button className="login-btn primary" type="submit">
                                                    Login
                                                </Button>
                                            </div>
                                        </Form>
                                    </Tab>

                                    <Tab eventKey="register" title="Register">
                                        <Form onSubmit={handleRegister} className="login-form">
                                            {registerError && (
                                                <Alert variant="danger" className="login-alert inline">
                                                    {registerError}
                                                </Alert>
                                            )}
                                            <Form.Group className="mb-3">
                                                <Form.Label>Name</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    required
                                                />
                                            </Form.Group>

                                            <Form.Group className="mb-3">
                                                <Form.Label>Email address</Form.Label>
                                                <Form.Control
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    required
                                                />
                                            </Form.Group>

                                            <Form.Group className="mb-3">
                                                <Form.Label>Password</Form.Label>
                                                <div className="password-field" style={{ display: 'flex', alignItems: 'center' }}>
                                                    <Form.Control
                                                        type={showPassword ? "text" : "password"}
                                                        name="password"
                                                        value={formData.password}
                                                        onChange={handleInputChange}
                                                        required
                                                        style={{ flex: 1 }}
                                                    />
                                                    <Button
                                                        variant="outline-secondary"
                                                        className="password-toggle"
                                                        onClick={togglePasswordVisibility}
                                                        style={{ marginLeft: '10px' }}
                                                    >
                                                        {showPassword ? "Hide" : "Show"}
                                                    </Button>
                                                </div>
                                            </Form.Group>

                                            <Form.Group className="mb-3">
                                                <Form.Label>Role</Form.Label>
                                                <Form.Select
                                                    name="role"
                                                    value={formData.role}
                                                    onChange={handleInputChange}
                                                    required
                                                >
                                                    <option value="MAN">Manufacturer</option>
                                                    <option value="DIS">Distributor</option>
                                                    <option value="RET">Retailer</option>
                                                    <option value="SUP">Supplier</option>
                                                </Form.Select>
                                            </Form.Group>

                                            <Form.Group className="mb-3">
                                                <Form.Label>Ethereum Address</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="walletAddress"
                                                    value={formData.walletAddress}
                                                    onChange={handleInputChange}
                                                    placeholder="0x... or leave empty to use connected MetaMask wallet"
                                                />
                                            </Form.Group>

                                            <div className="d-grid">
                                                <Button className="login-btn success" type="submit">
                                                    Register
                                                </Button>
                                            </div>
                                        </Form>
                                    </Tab>

                                    <Tab eventKey="" title="">
                                        <div className="assign-card">
                                            <AssignRoles />
                                        </div>
                                    </Tab>
                                </Tabs>

                                <div className="mt-3 current-account">
                                    <p className="mb-0">
                                        <strong>Current Account:</strong> {currentaccount || 'Not connected'}
                                    </p>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </div>
    );
}

export default Login;