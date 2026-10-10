import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

jest.mock('./services/authService', () => ({
  authService: { login: jest.fn() },
}));

test('renders login when unauthenticated', async () => {
  localStorage.clear();
  const { default: App } = await import('./App');
  render(<App />);
  expect(await screen.findByText(/tickets ti/i)).toBeInTheDocument();
});
