import { useState } from 'react';
import UserModal from '../components/users/UserModal';
import { useUsuarios, filtrarUsuarios } from '../hooks/useUsuarios';

const ROL_BADGE = {
  administrador: 'bg-purple-100 text-purple-800',
  tecnico: 'bg-blue-100 text-blue-800',
  usuario: 'bg-gray-100 text-gray-700',
};

// authcore solo agrega roles: se ofrecen los que el usuario aún no tiene
const ROLES_ASIGNABLES = [['tecnico', 'TECNICO', 'Técnico'], ['administrador', 'ADMIN', 'Administrador']];

const SELECT = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function FilaUsuario({ usuario, onAsignarRol }) {
  const disponibles = ROLES_ASIGNABLES.filter(([, role]) => !usuario.roles.includes(role));
  const asignar = (e) => {
    const rol = e.target.value;
    e.target.value = '';
    if (rol && window.confirm(`¿Asignar el rol ${rol} a ${usuario.username}?`)) onAsignarRol(usuario, rol);
  };

  return (
    <tr className="border-t hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 font-medium text-gray-900">{usuario.username}</td>
      <td className="px-4 py-3 text-gray-600">{usuario.email || '—'}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${ROL_BADGE[usuario.rol] || 'bg-gray-100'}`}>
          {usuario.rol || 'sin rol'}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {disponibles.length > 0 ? (
          <select defaultValue="" onChange={asignar} className={`${SELECT} py-1 text-xs`} aria-label={`Asignar rol a ${usuario.username}`}>
            <option value="">Asignar rol...</option>
            {disponibles.map(([rol, , etiqueta]) => <option key={rol} value={rol}>{etiqueta}</option>)}
          </select>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}

export default function Users() {
  const { usuarios, loading, recargar, asignarRol } = useUsuarios();
  const [search, setSearch] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [creando, setCreando] = useState(false);
  const visibles = filtrarUsuarios(usuarios, { search, rol: filtroRol });

  const onSaved = () => {
    setCreando(false);
    recargar();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{usuarios.length} usuarios registrados en authcore</p>
        </div>
        <button
          onClick={() => setCreando(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Nuevo usuario
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por usuario o email..."
          className={`flex-1 min-w-48 ${SELECT}`}
        />
        <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} className={SELECT}>
          <option value="">Todos los roles</option>
          <option value="usuario">Usuario</option>
          <option value="tecnico">Técnico</option>
          <option value="administrador">Administrador</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando...</div>
        ) : visibles.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No se encontraron usuarios</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((u) => <FilaUsuario key={u.id} usuario={u} onAsignarRol={asignarRol} />)}
            </tbody>
          </table>
        )}
      </div>

      {creando && <UserModal onClose={() => setCreando(false)} onSaved={onSaved} />}
    </div>
  );
}
