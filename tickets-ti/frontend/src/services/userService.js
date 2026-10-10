import api from './api';
import { authService } from './authService';
import { rolDesdeRoles, ROLES_AUTHCORE } from '../utils/sesion';

// Usuario de authcore { id, username, email, roles } con el rol del dominio
const _conRol = (u) => ({ ...u, rol: rolDesdeRoles(u.roles) });

export const userService = {
  // GET /auth/users (solo ADMIN). authcore no pagina: devuelve todos.
  listar: () => api.get('/auth/users').then((r) => r.data.map(_conRol)),

  // authcore asigna roles agregándolos (no reemplaza ni quita)
  asignarRol: (id, rol) => api.post(`/auth/users/${id}/roles`, { role: ROLES_AUTHCORE[rol] }),

  // register crea con rol USER; si se pidió otro rol, se agrega después
  crear: async ({ username, email, password, rol }) => {
    const { id } = await authService.register({ username, email, password });
    if (rol !== 'usuario') await userService.asignarRol(id, rol);
    return id;
  },

  listarTecnicos: async () => {
    const usuarios = await userService.listar();
    return usuarios
      .filter((u) => u.roles.includes('TECNICO'))
      .map((u) => ({ id: u.id, nombre: u.username, email: u.email }));
  },
};

// authcore responde errores como { error: '...' }
export const mensajeDeError = (err, porDefecto) => err.response?.data?.error || porDefecto;
