import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  CssBaseline,
  Divider,
  Button,
} from '@mui/material';
import { LockOutlined as LockIcon } from '@mui/icons-material';

const AuthLayout = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f5',
      }}
    >
      <CssBaseline />
      
      {/* Header */}
      <Box
        component="header"
        sx={{
          py: 2,
          px: 3,
          backgroundColor: 'white',
          boxShadow: 1,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              variant="h6"
              component={Link}
              to="/"
              sx={{
                textDecoration: 'none',
                color: 'primary.main',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <LockIcon sx={{ mr: 1 }} />
              PCI Document Manager
            </Typography>
            
            <Box>
              <Button
                component={Link}
                to="/login"
                color="primary"
                sx={{ mr: 1 }}
              >
                Iniciar Sesión
              </Button>
              <Button
                component={Link}
                to="/register"
                variant="contained"
                color="primary"
              >
                Registrarse
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
      
      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 8,
        }}
      >
        <Container maxWidth="sm">
          <Paper
            elevation={3}
            sx={{
              p: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Outlet />
          </Paper>
        </Container>
      </Box>
      
      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          backgroundColor: 'white',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            PCI Document Manager &copy; {new Date().getFullYear()}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Typography
              variant="body2"
              component={Link}
              to="/terms"
              sx={{ color: 'text.secondary', textDecoration: 'none' }}
            >
              Términos de Servicio
            </Typography>
            <Typography
              variant="body2"
              component={Link}
              to="/privacy"
              sx={{ color: 'text.secondary', textDecoration: 'none' }}
            >
              Política de Privacidad
            </Typography>
            <Typography
              variant="body2"
              component={Link}
              to="/help"
              sx={{ color: 'text.secondary', textDecoration: 'none' }}
            >
              Ayuda
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default AuthLayout;