import { useAuth } from '../context/AuthContext';

// authcore no expone cambio de contraseña: el perfil
// muestra los datos de la sesión, que vienen del JWT.
export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi Perfil</h1>
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="space-y-3 text-sm">
          <div><span className="text-gray-500">Usuario:</span> <span className="font-medium ml-2">{user?.username}</span></div>
          <div><span className="text-gray-500">Rol:</span> <span className="font-medium ml-2 capitalize">{user?.rol}</span></div>
        </div>
        <p className="text-xs text-gray-400 mt-6">
          Para cambiar tu contraseña o tu rol, contacta a un administrador.
        </p>
      </div>
    </div>
  );
}
