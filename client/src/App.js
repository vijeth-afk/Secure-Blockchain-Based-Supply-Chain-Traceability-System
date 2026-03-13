import React from 'react';
import './App.css';
import axios from 'axios';
import AssignRoles from './AssignRoles';
import Home from './Home';
import AddMed from './AddMed';
import Supply from './Supply'
import Track from './Track'
import RawMaterial from './RawMaterial'
import Manufacturing from './Manufacturing'
import DistributorInventory from './DistributorInventory'
import RetailerInventory from './RetailerInventory'
import Login from './Login'
import ProtectedRoute from './ProtectedRoute'
import AnomalyAlerts from './AnomalyAlerts'
import AnomalyDashboard from './AnomalyDashboard'
import { BrowserRouter as Router, Switch, Route } from "react-router-dom"

function App() {
  // Configure axios defaults from any stored token
  React.useEffect(() => {
    const token = localStorage.getItem('token');
    axios.defaults.baseURL = 'http://localhost:5002';
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);
  return (
    <div className="App">
      <Router>
        <Switch>
          <Route path="/" exact component={Login} />
          <ProtectedRoute path="/home" component={Home} />
          <ProtectedRoute path="/addmed" component={AddMed} allowedRoles={["MAN", "ADMIN"]} />
          <ProtectedRoute path="/supply" component={Supply} allowedRoles={["ADMIN", "MAN", "DIS"]} />
          <ProtectedRoute path="/track" component={Track} allowedRoles={["MAN", "DIS", "RET", "SUP", "ADMIN"]} />
          <ProtectedRoute path="/raw-materials" component={RawMaterial} allowedRoles={["SUP", "ADMIN", "MAN"]} />
          <ProtectedRoute path="/manufacturing" component={Manufacturing} allowedRoles={["MAN", "ADMIN"]} />
          <ProtectedRoute path="/distributor-inventory" component={DistributorInventory} allowedRoles={["DIS", "ADMIN", "MAN"]} />
          <ProtectedRoute path="/retailer-inventory" component={RetailerInventory} allowedRoles={["RET", "ADMIN", "MAN"]} />
          <ProtectedRoute path="/anomaly-alerts" component={AnomalyAlerts} allowedRoles={["ADMIN", "MAN", "DIS", "RET", "SUP"]} />
          <ProtectedRoute path="/anomaly-dashboard" component={AnomalyDashboard} allowedRoles={["ADMIN", "MAN", "DIS", "RET", "SUP"]} />
        </Switch>
      </Router>
    </div>
  );
}

export default App;
