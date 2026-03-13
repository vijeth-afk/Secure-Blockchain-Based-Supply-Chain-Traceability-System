import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import "./Login.css";

function Register() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'MAN',
        walletAddress: ''
    });
    const [showPassword, setShowPassword] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const handleRegister = (e) => {
        e.preventDefault();
        // Registration logic here
    };

    return (
        <Form onSubmit={handleRegister} className="login-form">
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
                <div className="password-field">
                    <Form.Control
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                    />
                    <Button
                        variant="outline-secondary"
                        className="password-toggle"
                        onClick={togglePasswordVisibility}
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
    );
}

export default Register;