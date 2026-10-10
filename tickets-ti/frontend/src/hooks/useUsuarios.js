import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { userService, mensajeDeError } from '../services/userService';

// Lista de usuarios de authcore con filtros en el cliente (authcore no pagina ni filtra)
export const useUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    try {
      setUsuarios(await userService.listar());
    } catch (err) {
      toast.error(mensajeDeError(err, 'Error al cargar usuarios'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  const asignarRol = async (usuario, rol) => {
    try {
      await userService.asignarRol(usuario.id, rol);
      toast.success(`Rol ${rol} asignado a ${usuario.username}`);
      await recargar();
    } catch (err) {
      toast.error(mensajeDeError(err, 'Error al asignar el rol'));
    }
  };

  return { usuarios, loading, recargar, asignarRol };
};

export const filtrarUsuarios = (usuarios, { search, rol }) => {
  const texto = search.trim().toLowerCase();
  return usuarios.filter((u) =>
    (!rol || u.rol === rol) &&
    (!texto || u.username.toLowerCase().includes(texto) || (u.email || '').toLowerCase().includes(texto)));
};
