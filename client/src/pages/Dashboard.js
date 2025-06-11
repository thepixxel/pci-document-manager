import React from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Description as DocumentIcon,
  Warning as WarningIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Componente para mostrar estadísticas en tarjetas
const StatCard = ({ title, value, icon, color, bgColor }) => (
  <Paper
    elevation={2}
    sx={{
      p: 3,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      bgcolor: bgColor,
      borderRadius: 2,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
      <Box sx={{ mr: 2, color }}>{icon}</Box>
      <Typography variant="h6" color="text.secondary">
        {title}
      </Typography>
    </Box>
    <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color }}>
      {value}
    </Typography>
  </Paper>
);

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Obtener estadísticas de documentos
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery(
    'documentStats',
    async () => {
      const res = await axios.get('/api/documents/stats');
      return res.data.data;
    },
    {
      refetchInterval: 5 * 60 * 1000, // Refrescar cada 5 minutos
    }
  );

  // Obtener documentos por vencer
  const { data: expiringDocs, isLoading: expiringLoading, error: expiringError, refetch: refetchExpiring } = useQuery(
    'expiringDocuments',
    async () => {
      const res = await axios.get('/api/documents/expiring');
      return res.data.data;
    },
    {
      refetchInterval: 5 * 60 * 1000, // Refrescar cada 5 minutos
    }
  );

  // Función para refrescar datos
  const refreshData = () => {
    refetchStats();
    refetchExpiring();
  };

  // Función para obtener color según estado
  const getStatusColor = (status) => {
    switch (status) {
      case 'Válido':
        return 'success';
      case 'Por Vencer':
        return 'warning';
      case 'Vencido':
        return 'error';
      case 'Inválido':
        return 'error';
      default:
        return 'default';
    }
  };

  // Función para obtener icono según estado
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Válido':
        return <ValidIcon color="success" />;
      case 'Por Vencer':
        return <WarningIcon color="warning" />;
      case 'Vencido':
        return <ErrorIcon color="error" />;
      case 'Inválido':
        return <ErrorIcon color="error" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  // Calcular días restantes
  const getDaysRemaining = (expirationDate) => {
    const today = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (statsLoading || expiringLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (statsError || expiringError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error al cargar datos del dashboard. Por favor intente nuevamente.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={refreshData}
        >
          Actualizar
        </Button>
      </Box>

      {/* Tarjetas de estadísticas */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Documentos"
            value={stats?.totalDocuments || 0}
            icon={<DocumentIcon fontSize="large" />}
            color="#2196f3"
            bgColor="#e3f2fd"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Documentos Válidos"
            value={stats?.byStatus?.valid || 0}
            icon={<ValidIcon fontSize="large" />}
            color="#4caf50"
            bgColor="#e8f5e9"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Por Vencer"
            value={stats?.byStatus?.expiring || 0}
            icon={<WarningIcon fontSize="large" />}
            color="#ff9800"
            bgColor="#fff3e0"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Vencidos"
            value={stats?.byStatus?.expired || 0}
            icon={<ErrorIcon fontSize="large" />}
            color="#f44336"
            bgColor="#ffebee"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Documentos por vencer */}
        <Grid item xs={12} md={7}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>
              Documentos Próximos a Vencer
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {expiringDocs && expiringDocs.length > 0 ? (
              <List>
                {expiringDocs.slice(0, 5).map((doc) => (
                  <ListItem
                    key={doc._id}
                    button
                    onClick={() => navigate(`/documents/${doc._id}`)}
                    sx={{ 
                      mb: 1, 
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
                    }}
                  >
                    <ListItemIcon>
                      {getStatusIcon(doc.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={doc.merchantName}
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="text.primary">
                            {doc.documentType}
                          </Typography>
                          {` — Vence: ${new Date(doc.expirationDate).toLocaleDateString('es-ES')}`}
                        </>
                      }
                    />
                    <Chip
                      label={`${getDaysRemaining(doc.expirationDate)} días`}
                      color={getDaysRemaining(doc.expirationDate) <= 7 ? 'error' : 'warning'}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ py: 2 }}>
                No hay documentos próximos a vencer.
              </Typography>
            )}
            
            {expiringDocs && expiringDocs.length > 5 && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  variant="text"
                  onClick={() => navigate('/documents?status=Por+Vencer')}
                >
                  Ver todos ({expiringDocs.length})
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Acciones rápidas y resumen */}
        <Grid item xs={12} md={5}>
          <Grid container spacing={3} direction="column">
            <Grid item>
              <Card elevation={2} sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Acciones Rápidas
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={<DocumentIcon />}
                        onClick={() => navigate('/documents')}
                      >
                        Ver Documentos
                      </Button>
                    </Grid>
                    <Grid item xs={6}>
                      <Button
                        variant="contained"
                        color="secondary"
                        fullWidth
                        startIcon={<WarningIcon />}
                        onClick={() => navigate('/documents?status=Por+Vencer')}
                      >
                        Por Vencer
                      </Button>
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<DocumentIcon />}
                        onClick={() => navigate('/documents/upload')}
                      >
                        Subir Nuevo Documento
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item>
              <Card elevation={2} sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Resumen por Tipo de Documento
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {stats && stats.byType && stats.byType.length > 0 ? (
                    <List dense>
                      {stats.byType.map((type) => (
                        <ListItem key={type._id}>
                          <ListItemIcon>
                            <DocumentIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={type._id}
                          />
                          <Chip
                            label={type.count}
                            size="small"
                            color="primary"
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body1" color="text.secondary" sx={{ py: 2 }}>
                      No hay datos disponibles.
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    onClick={() => navigate('/documents')}
                  >
                    Ver Todos los Documentos
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;