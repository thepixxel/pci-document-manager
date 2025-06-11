import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

// Create context
const AuthContext = createContext();

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Configure axios
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load user on mount or token change
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await axios.get('/api/auth/me');
        setUser(res.data.data);
        setError(null);
      } catch (err) {
        console.error('Error loading user:', err);
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        setError('Error de autenticación. Por favor inicie sesión nuevamente.');
        toast.error('Su sesión ha expirado. Por favor inicie sesión nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [token]);

  // Register user
  const register = async (userData) => {
    try {
      setLoading(true);
      const res = await axios.post('/api/auth/register', userData);
      
      setToken(res.data.token);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      setError(null);
      
      toast.success('Registro exitoso');
      return { success: true };
    } catch (err) {
      console.error('Error registering:', err);
      const errorMessage = err.response?.data?.message || 'Error al registrarse';
      setError(errorMessage);
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Login user
  const login = async (email, password) => {
    try {
      setLoading(true);
      const res = await axios.post('/api/auth/login', { email, password });
      
      setToken(res.data.token);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      setError(null);
      
      toast.success('Inicio de sesión exitoso');
      return { success: true };
    } catch (err) {
      console.error('Error logging in:', err);
      const errorMessage = err.response?.data?.message || 'Credenciales inválidas';
      setError(errorMessage);
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Logout user
  const logout = async () => {
    try {
      await axios.get('/api/auth/logout');
    } catch (err) {
      console.error('Error logging out:', err);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      toast.info('Sesión cerrada');
    }
  };

  // Update user profile
  const updateProfile = async (userData) => {
    try {
      setLoading(true);
      const res = await axios.put('/api/auth/updatedetails', userData);
      
      setUser(res.data.data);
      setError(null);
      
      toast.success('Perfil actualizado correctamente');
      return { success: true };
    } catch (err) {
      console.error('Error updating profile:', err);
      const errorMessage = err.response?.data?.message || 'Error al actualizar perfil';
      setError(errorMessage);
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Update password
  const updatePassword = async (passwordData) => {
    try {
      setLoading(true);
      await axios.put('/api/auth/updatepassword', passwordData);
      
      setError(null);
      
      toast.success('Contraseña actualizada correctamente');
      return { success: true };
    } catch (err) {
      console.error('Error updating password:', err);
      const errorMessage = err.response?.data?.message || 'Error al actualizar contraseña';
      setError(errorMessage);
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Forgot password
  const forgotPassword = async (email) => {
    try {
      setLoading(true);
      await axios.post('/api/auth/forgotpassword', { email });
      
      setError(null);
      
      toast.success('Se ha enviado un correo con instrucciones para restablecer su contraseña');
      return { success: true };
    } catch (err) {
      console.error('Error in forgot password:', err);
      const errorMessage = err.response?.data?.message || 'Error al procesar la solicitud';
      setError(errorMessage);
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (password, resetToken) => {
    try {
      setLoading(true);
      await axios.put(`/api/auth/resetpassword/${resetToken}`, { password });
      
      setError(null);
      
      toast.success('Contraseña restablecida correctamente');
      return { success: true };
    } catch (err) {
      console.error('Error resetting password:', err);
      const errorMessage = err.response?.data?.message || 'Error al restablecer contraseña';
      setError(errorMessage);
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        register,
        login,
        logout,
        updateProfile,
        updatePassword,
        forgotPassword,
        resetPassword,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;