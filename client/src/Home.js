import React, { useEffect } from "react";
import { useHistory } from "react-router-dom";
import "./Home.css";

function Home() {
  const history = useHistory();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      history.push('/');
    }
  }, [history]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    // clear axios auth header
    try { delete (require('axios').defaults.headers.common['Authorization']); } catch (e) { }
    history.push('/');
  };
  const role = localStorage.getItem('userRole') || '';
  const isSupplier = role === 'SUP';
  const isDistributor = role === 'DIS';
  const isRetailer = role === 'RET';
  const redirect_to_roles = () => {
    history.push("/roles");
  };
  const redirect_to_addmed = () => {
    history.push("/addmed");
  };
  const redirect_to_supply = () => {
    history.push("/supply");
  };
  const redirect_to_track = () => {
    history.push("/track");
  };

  const redirect_to_raw_materials = () => {
    history.push("/raw-materials");
  };

  const redirect_to_manufacturing = () => {
    history.push("/manufacturing");
  };

  const redirect_to_distributor_inventory = () => {
    history.push("/distributor-inventory");
  };

  const redirect_to_retailer_inventory = () => {
    history.push("/retailer-inventory");
  };

  const redirect_to_anomaly_alerts = () => {
    history.push("/anomaly-alerts");
  };

  const redirect_to_anomaly_dashboard = () => {
    history.push("/anomaly-dashboard");
  };
  // Role-based visibility map
  const can = {
    ADMIN: { all: true },
    MAN: {
      addmed: true,
      supply: true,
      track: true,
      manufacturing: true,
      rawMaterials: true,
      distributorInventory: true,
      retailerInventory: true
    },
    DIS: {
      supply: true,
      track: true,
      distributorInventory: true
    },
    RET: {
      track: true,
      retailerInventory: true
    },
    SUP: {
      track: true,
      rawMaterials: true
    }
  };

  const roleCaps = can[role] || {};

  return (
    <div className="home-page">
      <div className="grid-overlay" aria-hidden="true" />
      <div className="pulse-glow" aria-hidden="true" />
      <div className="home-content">
        <header className="home-header">
          <div>
            <p className="eyebrow">Supply Chain Control Center</p>
            <h3>Supply Chain Flow</h3>
            <p className="subcopy">
              Coordinate suppliers, manufacturers, distributors, and retailers from a single futuristic hub.
            </p>
          </div>
          <div className="user-badge">
            <span>Welcome, {localStorage.getItem('userName')}</span>
            <span>
              Role: <strong>{role}</strong>
            </span>
            <button onClick={handleLogout} className="action-btn danger">
              Logout
            </button>
          </div>
        </header>

        {(!isDistributor && !isRetailer) && (
          <section className="step-card">
            <div className="step-heading">
              <span className="step-pill accent">Resources</span>
              <h5>Manage Raw Materials</h5>
            </div>
            {(role === 'ADMIN' || roleCaps.rawMaterials || roleCaps.all) && (
              <button onClick={redirect_to_raw_materials} className="action-btn">
                Raw Materials Inventory
              </button>
            )}
          </section>
        )}

        {!isSupplier && (
          <>
            {(!isDistributor && !isRetailer) && (
              <section className="step-card">
                <div className="step-heading">
                  <span className="step-pill accent">Production</span>
                  <h5>Manage Manufacturing</h5>
                </div>
                {(role === 'ADMIN' || roleCaps.manufacturing || roleCaps.all) && (
                  <button onClick={redirect_to_manufacturing} className="action-btn">
                    Manufacturing Inventory
                  </button>
                )}
              </section>
            )}

            {!isRetailer && (
              <section className="step-card">
                <div className="step-heading">
                  <span className="step-pill accent">Distribution</span>
                  <h5>Manage Distribution</h5>
                </div>
                {(role === 'ADMIN' || roleCaps.distributorInventory || roleCaps.all) && (
                  <button onClick={redirect_to_distributor_inventory} className="action-btn">
                    Distributor Inventory
                  </button>
                )}
              </section>
            )}

            {!isDistributor && (
              <section className="step-card">
                <div className="step-heading">
                  <span className="step-pill accent">Retail</span>
                  <h5>Manage Retail</h5>
                </div>
                {(role === 'ADMIN' || roleCaps.retailerInventory || roleCaps.all) && (
                  <button onClick={redirect_to_retailer_inventory} className="action-btn">
                    Retailer Inventory
                  </button>
                )}
              </section>
            )}
          </>
        )}

        <hr className="divider" />

        <section className="step-card">
          <div className="step-heading">
            <span className="step-pill warning">🚨 AI Security</span>
            <h5>Anomaly Detection Alerts</h5>
          </div>
          <p className="step-note">View and manage detected anomalies in real-time</p>
          <button onClick={redirect_to_anomaly_alerts} className="action-btn warning">
            View Anomaly Alerts
          </button>
        </section>

        <section className="step-card">
          <div className="step-heading">
            <span className="step-pill warning">📊 Analytics</span>
            <h5>Anomaly Detection Dashboard</h5>
          </div>
          <p className="step-note">Monitor statistics and trends</p>
          <button onClick={redirect_to_anomaly_dashboard} className="action-btn warning">
            View Dashboard
          </button>
        </section>
      </div>
    </div>
  );
}

export default Home;
