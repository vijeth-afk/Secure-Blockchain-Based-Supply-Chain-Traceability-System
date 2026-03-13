import React from 'react';
import { Route, Redirect } from 'react-router-dom';

// ProtectedRoute guards routes by allowedRoles array. ADMIN bypasses checks.
const ProtectedRoute = ({ component: Component, allowedRoles = [], ...rest }) => {
  return (
    <Route
      {...rest}
      render={(props) => {
        const role = localStorage.getItem('userRole');
        // If no role stored, redirect to login
        if (!role) {
          return <Redirect to={{ pathname: '/', state: { from: props.location } }} />;
        }

        // ADMIN can access everything
        if (role === 'ADMIN') {
          return <Component {...props} />;
        }

        // If allowedRoles empty, allow all authenticated users
        if (allowedRoles.length === 0 || allowedRoles.includes(role)) {
          return <Component {...props} />;
        }

        // Not authorized
        alert('Access denied: your role does not have permission to access this page.');
        return <Redirect to={{ pathname: '/home' }} />;
      }}
    />
  );
};

export default ProtectedRoute;
