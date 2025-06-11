import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box, Typography } from '@mui/material';

/**
 * AdminRoute component
 * Protects routes that require admin privileges
 * Redirects to dashboard if user is not an admin
 */
const AdminRoute = () => {
  const { user, isAuthenticated, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to dashboard if not an admin
  if (user.role !== 'admin') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          p: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="h4" color="error" gutterBottom>
          Acceso Restringido
        </Typography>
        <Typography variant="body1" paragraph>
          No tiene permisos para acceder a esta sección.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Esta área está reservada para administradores.
        </Typography>
        <Box sx={{ mt: 3 }}>
          <Navigate to="/dashboard" replace />
        </Box>
      </Box>
    );
  }

  // Render the protected route for admin
  return <Outlet />;
};

export default AdminRoute;