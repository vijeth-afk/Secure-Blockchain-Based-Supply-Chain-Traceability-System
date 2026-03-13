import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import './AnomalyDashboard.css';

const AnomalyDashboard = () => {
    const history = useHistory();
    const [stats, setStats] = useState(null);
    const [diagnostic, setDiagnostic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);
    const [dataSource, setDataSource] = useState('server'); // 'server' or 'diagnostic'

    useEffect(() => {
        fetchStats();
        fetchDiagnosticData();
    }, [days]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5002/api/anomalies/stats/summary?days=${days}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            setStats(data);
            setDataSource('server');
        } catch (error) {
            console.error('Error fetching stats:', error);
            console.log('Falling back to diagnostic data...');
        } finally {
            setLoading(false);
        }
    };

    const fetchDiagnosticData = async () => {
        try {
            const response = await fetch('http://localhost:3000/diagnostic-dashboard-data.json');
            if (response.ok) {
                const data = await response.json();
                setDiagnostic(data);
                // If server stats failed, use diagnostic data
                if (!stats) {
                    setStats({
                        summary: {
                            total: data.totalTests,
                            critical: data.severityBreakdown.critical || 0,
                            high: data.severityBreakdown.high || 0,
                            medium: data.severityBreakdown.medium || 0,
                            low: data.severityBreakdown.low || 0,
                            new: data.totalTests - data.passed,
                            acknowledged: 0,
                            resolved: data.passed
                        },
                        bySeverity: Object.entries(data.severityBreakdown).map(([sev, count]) => ({
                            _id: sev,
                            count: count || 0
                        })),
                        byType: []
                    });
                    setDataSource('diagnostic');
                }
            }
        } catch (error) {
            console.log('Diagnostic data not available');
        }
    };

    if (loading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    if (!stats) {
        return <div className="error">Failed to load statistics</div>;
    }

    const { summary, bySeverity, byType } = stats;

    return (
        <div className="anomaly-dashboard">
            <div className="page-header">
                <h1>📊 Anomaly Detection Dashboard</h1>
                <button onClick={() => history.push('/home')} className="btn-back-home">
                    ← Back to Home
                </button>
            </div>

            {/* Data Source Indicator */}
            {diagnostic && (
                <div className={`data-source-indicator ${dataSource}`}>
                    <span className="source-badge">{dataSource === 'diagnostic' ? '🧪 Diagnostic Mode' : '🖥️ Live Server'}</span>
                    {diagnostic && <span className="diagnostic-badge">Diagnostic Pass Rate: {diagnostic.passRate}%</span>}
                </div>
            )}

            {/* Time Range Selector */}
            <div className="time-selector">
                <button onClick={() => setDays(1)} className={days === 1 ? 'active' : ''}>24 Hours</button>
                <button onClick={() => setDays(7)} className={days === 7 ? 'active' : ''}>7 Days</button>
                <button onClick={() => setDays(30)} className={days === 30 ? 'active' : ''}>30 Days</button>
            </div>

            {/* Summary Cards */}
            <div className="stats-grid">
                <div className="stat-card total">
                    <div className="stat-number">{summary.total || 0}</div>
                    <div className="stat-label">Total Alerts</div>
                </div>

                <div className="stat-card critical">
                    <div className="stat-number">{summary.critical || 0}</div>
                    <div className="stat-label">Critical</div>
                </div>

                <div className="stat-card high">
                    <div className="stat-number">{summary.high || 0}</div>
                    <div className="stat-label">High</div>
                </div>

                <div className="stat-card medium">
                    <div className="stat-number">{summary.medium || 0}</div>
                    <div className="stat-label">Medium</div>
                </div>

                <div className="stat-card low">
                    <div className="stat-number">{summary.low || 0}</div>
                    <div className="stat-label">Low</div>
                </div>
            </div>

            {/* Status Overview */}
            <div className="status-overview">
                <h2>Status Overview</h2>
                <div className="status-grid">
                    <div className="status-item new">
                        <div className="status-count">{summary.new || 0}</div>
                        <div className="status-name">New</div>
                    </div>
                    <div className="status-item acknowledged">
                        <div className="status-count">{summary.acknowledged || 0}</div>
                        <div className="status-name">Acknowledged</div>
                    </div>
                    <div className="status-item resolved">
                        <div className="status-count">{summary.resolved || 0}</div>
                        <div className="status-name">Resolved</div>
                    </div>
                </div>
            </div>

            {/* Severity Breakdown */}
            <div className="breakdown-section">
                <h2>Severity Breakdown</h2>
                <div className="breakdown-list">
                    {bySeverity && bySeverity.length > 0 ? (
                        bySeverity.map(item => (
                            <div key={item._id} className="breakdown-item">
                                <span className={`severity-label ${item._id}`}>{item._id.toUpperCase()}</span>
                                <div className="breakdown-bar">
                                    <div
                                        className={`breakdown-fill ${item._id}`}
                                        style={{ width: `${(item.count / summary.total) * 100}%` }}
                                    ></div>
                                </div>
                                <span className="breakdown-count">{item.count}</span>
                            </div>
                        ))
                    ) : (
                        <div className="no-data">No data available</div>
                    )}
                </div>
            </div>

            {/* Type Breakdown */}
            <div className="breakdown-section">
                <h2>Anomaly Types</h2>
                <div className="breakdown-list">
                    {byType && byType.length > 0 ? (
                        byType.map(item => (
                            <div key={item._id} className="breakdown-item">
                                <span className="type-label">{item._id.replace('_', ' ').toUpperCase()}</span>
                                <div className="breakdown-bar">
                                    <div
                                        className="breakdown-fill type"
                                        style={{ width: `${(item.count / summary.total) * 100}%` }}
                                    ></div>
                                </div>
                                <span className="breakdown-count">{item.count}</span>
                            </div>
                        ))
                    ) : (
                        <div className="no-data">No data available</div>
                    )}
                </div>
            </div>

            {/* Diagnostic Test Results */}
            {diagnostic && (
                <div className="diagnostic-section">
                    <h2>🧪 Diagnostic Test Results</h2>
                    <div className="diagnostic-summary">
                        <div className="diagnostic-stat">
                            <div className="diagnostic-value">{diagnostic.totalTests}</div>
                            <div className="diagnostic-label">Total Tests</div>
                        </div>
                        <div className="diagnostic-stat passed">
                            <div className="diagnostic-value">{diagnostic.passed}</div>
                            <div className="diagnostic-label">Passed</div>
                        </div>
                        <div className="diagnostic-stat failed">
                            <div className="diagnostic-value">{diagnostic.failed}</div>
                            <div className="diagnostic-label">Failed</div>
                        </div>
                        <div className="diagnostic-stat">
                            <div className="diagnostic-value">{diagnostic.passRate.toFixed(1)}%</div>
                            <div className="diagnostic-label">Pass Rate</div>
                        </div>
                    </div>

                    <div className="diagnostic-tests">
                        <h3>Test Cases</h3>
                        <div className="test-list">
                            {diagnostic.testCases.map((test, idx) => (
                                <div key={idx} className={`test-item ${test.severity}`}>
                                    <div className="test-header">
                                        <span className={`test-status ${test.passed ? 'passed' : 'failed'}`}>
                                            {test.passed ? '✅' : '❌'}
                                        </span>
                                        <span className="test-name">{test.name}</span>
                                        <span className={`test-severity ${test.severity}`}>{test.severity.toUpperCase()}</span>
                                    </div>
                                    <div className="test-score">
                                        Score: {test.score.toFixed(1)}% {test.isAnomaly ? '(Anomaly)' : '(Normal)'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnomalyDashboard;
