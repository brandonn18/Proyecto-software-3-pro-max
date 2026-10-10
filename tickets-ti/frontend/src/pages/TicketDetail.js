import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ticketService } from '../services/ticketService';
import Badge from '../components/shared/Badge';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';

const TRANSICIONES = {
  asignado: ['en_proceso'],
  en_proceso: ['en_espera', 'resuelto'],
  en_espera: ['en_proceso'],
  resuelto: ['cerrado'],
};

const ACCION_LABEL = {
  TICKET_CREADO: 'Ticket creado',
  TICKET_ASIGNADO: 'Ticket asignado',
  CAMBIO_ESTADO: 'Cambio de estado',
  TICKET_REABIERTO: 'Ticket reabierto',
};

function SLABar({ ticket }) {
  if (!ticket.sla_limite || !ticket.createdAt) return null;

  const ahora = Date.now();
  const limite = new Date(ticket.sla_limite).getTime();
  const creado = new Date(ticket.createdAt).getTime();
  const total = limite - creado;
  const consumido = ahora - creado;
  const pct = total > 0 ? Math.min((consumido / total) * 100, 100) : 100;
  const vencido = ahora > limite;

  const colorBarra = vencido || pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500';
  const colorTexto = vencido || pct >= 100 ? 'text-red-700' : pct >= 80 ? 'text-yellow-700' : 'text-green-700';

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500">SLA consumido</span>
        <span className={`font-semibold ${colorTexto}`}>
          {vencido ? 'VENCIDO' : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${colorBarra}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">
        Límite: {new Date(ticket.sla_limite).toLocaleString('es-CO')}
      </p>
    </div>
  );
}

function Timeline({ auditorias = [] }) {
  if (!auditorias.length) return (
    <p className="text-sm text-gray-400 py-4">Sin historial de cambios aún.</p>
  );

  return (
    <ol className="relative border-l border-gray-200 ml-2 space-y-4">
      {auditorias.map((log) => (
        <li key={log.id} className="ml-4">
          <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-500" />
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">
              {ACCION_LABEL[log.accion] || log.accion}
            </span>
            {log.detalle?.de && log.detalle?.a && (
              <span className="text-xs text-gray-500">
                {log.detalle.de} → {log.detalle.a}
              </span>
            )}
          </div>
          {log.detalle?.motivo && (
            <p className="text-xs text-gray-500 mt-0.5">Motivo: {log.detalle.motivo}</p>
          )}
          {log.detalle?.comentario && (
            <p className="text-xs text-gray-500 mt-0.5">Comentario: {log.detalle.comentario}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {log.usuario?.nombre || 'Sistema'} · {new Date(log.createdAt).toLocaleString('es-CO')}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comentario, setComentario] = useState('');
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [reabriendo, setReabriendo] = useState(false);
  const [showReopenForm, setShowReopenForm] = useState(false);

  const cargarTicket = () =>
    ticketService.getById(id).then(setTicket).finally(() => setLoading(false));

  useEffect(() => {
    cargarTicket();
    if (user?.rol === 'administrador') {
      userService.listarTecnicos().then(setTecnicos).catch(() => setTecnicos([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const handleEstado = async (estado) => {
    setCambiandoEstado(true);
    try {
      const updated = await ticketService.updateStatus(id, estado, comentario.trim() || undefined);
      setTicket(updated);
      setComentario('');
      toast.success('Estado actualizado');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar estado');
    } finally {
      setCambiandoEstado(false);
    }
  };

  const handleAsignar = async (tecnicoId) => {
    if (!tecnicoId) return;
    try {
      const updated = await ticketService.assign(id, parseInt(tecnicoId));
      setTicket(updated);
      toast.success('Ticket asignado');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al asignar');
    }
  };

  const handleReabrir = async (e) => {
    e.preventDefault();
    if (!motivo.trim()) return toast.error('Debes indicar el motivo de reapertura');
    setReabriendo(true);
    try {
      const updated = await ticketService.reopen(id, motivo);
      setTicket(updated);
      setMotivo('');
      setShowReopenForm(false);
      toast.success('Ticket reabierto');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al reabrir');
    } finally {
      setReabriendo(false);
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Cargando...</div>;
  if (!ticket) return <div className="text-center py-16 text-red-500">Ticket no encontrado</div>;

  const puedeReabrir =
    ['resuelto', 'cerrado'].includes(ticket.estado) &&
    (user?.rol === 'usuario' || user?.rol === 'administrador');

  const transicionesDisponibles = user?.rol === 'administrador'
    ? (TRANSICIONES[ticket.estado] || [])
    : (TRANSICIONES[ticket.estado] || []).filter(
        () => user?.rol === 'tecnico' && Number(ticket.tecnicoId) === Number(user?.id)
      );

  const puedeActuar = user?.rol === 'administrador' ||
    (user?.rol === 'tecnico' && Number(ticket.tecnicoId) === Number(user?.id));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Info principal */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">{ticket.id}</p>
            <h1 className="text-xl font-bold text-gray-900">{ticket.titulo}</h1>
            <p className="text-gray-500 text-sm mt-1 capitalize">
              {ticket.tipo} · {ticket.categoria?.replace('_', ' ')}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Badge value={ticket.estado} />
            <Badge value={ticket.prioridad} />
          </div>
        </div>

        <p className="text-gray-700 whitespace-pre-wrap mb-6">{ticket.descripcion}</p>

        <div className="grid grid-cols-2 gap-3 text-sm border-t pt-4">
          <div><span className="text-gray-500">Creado por: </span><span className="font-medium">{ticket.usuario?.nombre}</span></div>
          <div><span className="text-gray-500">Técnico: </span><span className="font-medium">{ticket.tecnico?.nombre || '—'}</span></div>
          <div><span className="text-gray-500">Creado: </span><span className="font-medium">{new Date(ticket.createdAt).toLocaleString('es-CO')}</span></div>
          {ticket.reabierto && (
            <div><span className="text-gray-500">Motivo reapertura: </span><span className="font-medium">{ticket.motivo_reapertura}</span></div>
          )}
        </div>

        <SLABar ticket={ticket} />
      </div>

      {/* Acciones para técnico y admin */}
      {puedeActuar && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-3">Cambiar estado</h2>
          {transicionesDisponibles.length > 0 ? (
            <div className="space-y-3">
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Comentario opcional sobre el cambio de estado..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <div className="flex gap-2 flex-wrap">
                {transicionesDisponibles.map((e) => (
                  <button
                    key={e}
                    onClick={() => handleEstado(e)}
                    disabled={cambiandoEstado}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 capitalize transition-colors disabled:opacity-50"
                  >
                    → {e.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No hay transiciones disponibles desde "{ticket.estado}".</p>
          )}

          {user?.rol === 'administrador' && tecnicos.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reasignar técnico</label>
              <select
                onChange={(e) => handleAsignar(e.target.value)}
                defaultValue=""
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleccionar técnico...</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} {ticket.tecnicoId === t.id ? '(actual)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Reapertura (usuario o admin) */}
      {puedeReabrir && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-3">Reabrir ticket</h2>
          {!showReopenForm ? (
            <button
              onClick={() => setShowReopenForm(true)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
            >
              Reabrir ticket
            </button>
          ) : (
            <form onSubmit={handleReabrir} className="space-y-3">
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Describe por qué necesitas reabrir este ticket..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={reabriendo}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {reabriendo ? 'Reabriendo...' : 'Confirmar reapertura'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReopenForm(false); setMotivo(''); }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Historial de cambios */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Historial de cambios</h2>
        <Timeline auditorias={ticket.auditorias} />
      </div>
    </div>
  );
}
