import { useState } from 'react';
import { toast } from 'react-toastify';
import { userService, mensajeDeError } from '../../services/userService';

const FORM_VACIO = { username: '', email: '', password: '', rol: 'usuario' };
const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

// Reglas de RegisterRequest en authcore: username obligatorio, password >= 6, email opcional
const validar = (form) => {
  const errores = {};
  if (!form.username.trim()) errores.username = 'Usuario requerido';
  if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errores.email = 'Email inválido';
  if (form.password.length < 6) errores.password = 'Mínimo 6 caracteres';
  return errores;
};

const Campo = ({ label, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

export default function UserModal({ onClose, onSaved }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setErrors((er) => ({ ...er, [campo]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errores = validar(form);
    if (Object.keys(errores).length) return setErrors(errores);
    setSaving(true);
    try {
      await userService.crear({ ...form, username: form.username.trim() });
      toast.success('Usuario creado');
      onSaved();
    } catch (err) {
      toast.error(mensajeDeError(err, 'Error al crear el usuario'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Crear usuario</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Campo label="Usuario" error={errors.username}>
            <input type="text" value={form.username} onChange={set('username')} className={INPUT} placeholder="Ej: jperez" />
          </Campo>
          <Campo label="Email (opcional, para notificaciones)" error={errors.email}>
            <input type="email" value={form.email} onChange={set('email')} className={INPUT} placeholder="correo@empresa.com" />
          </Campo>
          <Campo label="Contraseña" error={errors.password}>
            <input type="password" value={form.password} onChange={set('password')} className={INPUT} placeholder="Mínimo 6 caracteres" />
          </Campo>
          <Campo label="Rol">
            <select value={form.rol} onChange={set('rol')} className={INPUT}>
              <option value="usuario">Usuario</option>
              <option value="tecnico">Técnico</option>
              <option value="administrador">Administrador</option>
            </select>
          </Campo>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : 'Crear usuario'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
