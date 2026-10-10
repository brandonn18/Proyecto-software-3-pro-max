import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLogin = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LoginForm — validaciones client-side', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockNavigate.mockReset();
  });

  test('Muestra error si el usuario está vacío al intentar hacer login', async () => {
    renderLogin();

    const boton = screen.getByRole('button', { name: /ingresar/i });
    await userEvent.click(boton);

    await waitFor(() => {
      expect(screen.getByText(/el usuario es requerido/i)).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('Muestra error si la contraseña está vacía', async () => {
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/tu usuario/i), 'luis');

    const boton = screen.getByRole('button', { name: /ingresar/i });
    await userEvent.click(boton);

    await waitFor(() => {
      expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('No muestra error con credenciales de formato válido', async () => {
    mockLogin.mockResolvedValue({ token: 'tok123', user: { rol: 'usuario' } });

    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/tu usuario/i), 'luis');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'Password1!');

    await userEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('luis', 'Password1!');
    });
    expect(screen.queryByText(/requerid[oa]/i)).not.toBeInTheDocument();
  });
});

describe('LoginForm — estado del botón', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockNavigate.mockReset();
  });

  test('El botón está habilitado en estado inicial', () => {
    renderLogin();
    const boton = screen.getByRole('button', { name: /ingresar/i });
    expect(boton).not.toBeDisabled();
  });

  test('Deshabilita el botón mientras la petición de login está en curso', async () => {
    // Login que nunca resuelve → simula petición lenta
    mockLogin.mockImplementation(() => new Promise(() => {}));

    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/tu usuario/i), 'luis');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'Password1!');

    const boton = screen.getByRole('button', { name: /ingresar/i });
    await userEvent.click(boton);

    await waitFor(() => {
      expect(boton).toBeDisabled();
    });
  });

  test('Muestra texto "Procesando..." en el botón durante la carga', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {}));

    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/tu usuario/i), 'luis');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText(/procesando/i)).toBeInTheDocument();
    });
  });
});

describe('LoginForm — manejo de errores de API', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockNavigate.mockReset();
  });

  test('Muestra mensaje de credenciales inválidas si el servidor responde 401', async () => {
    const err = new Error('Unauthorized');
    err.response = { status: 401, data: { error: 'Usuario o contrasena incorrectos' } };
    mockLogin.mockRejectedValue(err);

    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/tu usuario/i), 'malo');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'Wrongpass1!');
    await userEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText(/usuario o contraseña incorrectos/i)).toBeInTheDocument();
    });
  });

  test('Muestra el mensaje de error de authcore si no es 401', async () => {
    const err = new Error('Bad Request');
    err.response = { status: 400, data: { error: 'username: username es obligatorio' } };
    mockLogin.mockRejectedValue(err);

    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/tu usuario/i), 'luis');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'Test1234!');
    await userEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText(/username es obligatorio/i)).toBeInTheDocument();
    });
  });

  test('El botón vuelve a habilitarse después de un error', async () => {
    const err = new Error('Unauthorized');
    err.response = { status: 401, data: { error: 'Usuario o contrasena incorrectos' } };
    mockLogin.mockRejectedValue(err);

    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/tu usuario/i), 'x');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'Test1234!');

    const boton = screen.getByRole('button', { name: /ingresar/i });
    await userEvent.click(boton);

    await waitFor(() => {
      expect(boton).not.toBeDisabled();
    });
  });

  test('Login exitoso redirige según el rol del usuario', async () => {
    mockLogin.mockResolvedValue({ token: 'tok123', user: { rol: 'administrador' } });

    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/tu usuario/i), 'admin');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'Admin123!');
    await userEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });
});
