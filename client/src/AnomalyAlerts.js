import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useHistory } from 'react-router-dom';
import './AnomalyAlerts.css';

const AnomalyAlerts = () => {
    const history = useHistory();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ severity: '', status: '', affectedEntity: '' });
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // Initialize WebSocket connection
        const newSocket = io('http://localhost:5002');
        setSocket(newSocket);

        newSocket.on('anomaly_detected', (data) => {
            console.log('🚨 New anomaly detected:', data);
            // Add new alert to the top of the list
            setAlerts(prev => [data.alert, ...prev]);
            // Show notification
            showNotification(data.alert);
        });

        return () => newSocket.close();
    }, []);

    useEffect(() => {
        fetchAlerts();
    }, [filter]);

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filter.severity) params.append('severity', filter.severity);
            if (filter.status) params.append('status', filter.status);
            if (filter.affectedEntity) params.append('affectedEntity', filter.affectedEntity);

            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5002/api/anomalies?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            setAlerts(data.alerts || []);
        } catch (error) {
            console.error('Error fetching alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (alert) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Anomaly Detected!', {
                body: alert.description,
                icon: '/alert-icon.png'
            });
        }
    };

    const acknowledgeAlert = async (alertId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5002/api/anomalies/${alertId}/acknowledge`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const updatedAlert = await response.json();
            setAlerts(prev => prev.map(a => a._id === alertId ? updatedAlert : a));
            if (selectedAlert && selectedAlert._id === alertId) {
                setSelectedAlert(updatedAlert);
            }
        } catch (error) {
            console.error('Error acknowledging alert:', error);
        }
    };

    const resolveAlert = async (alertId, resolutionNotes, isFalsePositive = false) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5002/api/anomalies/${alertId}/resolve`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ resolutionNotes, isFalsePositive })
            });

            const updatedAlert = await response.json();
            setAlerts(prev => prev.map(a => a._id === alertId ? updatedAlert : a));
            if (selectedAlert && selectedAlert._id === alertId) {
                setSelectedAlert(null);
            }
        } catch (error) {
            console.error('Error resolving alert:', error);
        }
    };

    const getSeverityBadge = (severity) => {
        const colors = {
            critical: 'badge-critical',
            high: 'badge-high',
            medium: 'badge-medium',
            low: 'badge-low'
        };
        return <span className={`badge ${colors[severity]}`}>{severity.toUpperCase()}</span>;
    };

    const getStatusBadge = (status) => {
        const colors = {
            new: 'status-new',
            acknowledged: 'status-acknowledged',
            resolved: 'status-resolved',
            false_positive: 'status-false-positive'
        };
        return <span className={`status ${colors[status]}`}>{status.replace('_', ' ').toUpperCase()}</span>;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="anomaly-alerts-container">
            <div className="page-header">
                <h1>🚨 Anomaly Alerts</h1>
                <button onClick={() => history.push('/home')} className="btn-back-home">
                    ← Back to Home
                </button>
            </div>

            {/* Filters */}
            <div className="filters">
                <select value={filter.severity} onChange={(e) => setFilter({ ...filter, severity: e.target.value })}>
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>

                <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="resolved">Resolved</option>
                    <option value="false_positive">False Positive</option>
                </select>

                <select value={filter.affectedEntity} onChange={(e) => setFilter({ ...filter, affectedEntity: e.target.value })}>
                    <option value="">All Entities</option>
                    <option value="raw_material">Raw Material</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="distributor">Distributor</option>
                    <option value="retailer">Retailer</option>
                </select>

                <button onClick={fetchAlerts} className="btn-refresh">Refresh</button>
            </div>

            {/* Alerts List */}
            {loading ? (
                <div className="loading">Loading alerts...</div>
            ) : (
                <div className="alerts-list">
                    {alerts.length === 0 ? (
                        <div className="no-alerts">No anomaly alerts found.</div>
                    ) : (
                        alerts.map(alert => (
                            <div key={alert._id} className={`alert-card ${alert.severity}`} onClick={() => setSelectedAlert(alert)}>
                                <div className="alert-header">
                                    {getSeverityBadge(alert.severity)}
                                    {getStatusBadge(alert.status)}
                                    <span className="alert-time">{formatDate(alert.timestamp)}</span>
                                </div>
                                <div className="alert-type">{alert.anomalyType.replace('_', ' ').toUpperCase()}</div>
                                <div className="alert-description">{alert.description}</div>
                                <div className="alert-entity">
                                    Affected: {alert.affectedEntity.replace('_', ' ')} (ID: {alert.entityId.substring(0, 8)}...)
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Alert Detail Modal */}
            {selectedAlert && (
                <div className="modal-overlay" onClick={() => setSelectedAlert(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Alert Details</h2>
                        <button className="modal-close" onClick={() => setSelectedAlert(null)}>×</button>

                        <div className="modal-body">
                            <div className="detail-row">
                                <strong>Alert ID:</strong> {selectedAlert.alertId}
                            </div>
                            <div className="detail-row">
                                <strong>Severity:</strong> {getSeverityBadge(selectedAlert.severity)}
                            </div>
                            <div className="detail-row">
                                <strong>Status:</strong> {getStatusBadge(selectedAlert.status)}
                            </div>
                            <div className="detail-row">
                                <strong>Type:</strong> {selectedAlert.anomalyType.replace('_', ' ')}
                            </div>
                            <div className="detail-row">
                                <strong>Timestamp:</strong> {formatDate(selectedAlert.timestamp)}
                            </div>
                            <div className="detail-row">
                                <strong>Affected Entity:</strong> {selectedAlert.affectedEntity.replace('_', ' ')}
                            </div>
                            <div className="detail-row">
                                <strong>Entity ID:</strong> {selectedAlert.entityId}
                            </div>
                            <div className="detail-row">
                                <strong>Description:</strong> {selectedAlert.description}
                            </div>
                            <div className="detail-row">
                                <strong>Anomaly Score:</strong> {(selectedAlert.anomalyScore * 100).toFixed(1)}%
                            </div>

                            {selectedAlert.acknowledgedBy && (
                                <div className="detail-row">
                                    <strong>Acknowledged By:</strong> {selectedAlert.acknowledgedBy} at {formatDate(selectedAlert.acknowledgedAt)}
                                </div>
                            )}

                            {selectedAlert.resolvedBy && (
                                <div className="detail-row">
                                    <strong>Resolved By:</strong> {selectedAlert.resolvedBy} at {formatDate(selectedAlert.resolvedAt)}
                                </div>
                            )}

                            {selectedAlert.resolutionNotes && (
                                <div className="detail-row">
                                    <strong>Resolution Notes:</strong> {selectedAlert.resolutionNotes}
                                </div>
                            )}

                            <div className="modal-actions">
                                {selectedAlert.status === 'new' && (
                                    <button onClick={() => acknowledgeAlert(selectedAlert._id)} className="btn-acknowledge">
                                        Acknowledge
                                    </button>
                                )}
                                {(selectedAlert.status === 'new' || selectedAlert.status === 'acknowledged') && (
                                    <>
                                        <button onClick={() => {
                                            const notes = prompt('Enter resolution notes:');
                                            if (notes !== null) resolveAlert(selectedAlert._id, notes, false);
                                        }} className="btn-resolve">
                                            Resolve
                                        </button>
                                        <button onClick={() => {
                                            const notes = prompt('Enter notes for false positive:');
                                            if (notes !== null) resolveAlert(selectedAlert._id, notes, true);
                                        }} className="btn-false-positive">
                                            Mark as False Positive
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnomalyAlerts;
