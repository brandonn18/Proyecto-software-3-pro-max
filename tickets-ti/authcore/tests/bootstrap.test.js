const { sequelize, User } = require('../src/models');
const { asegurarAdministrador } = require('../src/services/bootstrapService');

const DATOS = { email: 'admin.bootstrap@test.com', password: 'Bootstrap123!' };

beforeEach(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('bootstrapService', () => {
  describe('asegurarAdministrador', () => {
    it('debería crear un administrador con la contraseña hasheada', async () => {
      const resultado = await asegurarAdministrador(DATOS);

      const admin = await User.findByPk(resultado.id);
      expect(resultado.creado).toBe(true);
      expect(admin.rol).toBe('administrador');
      expect(admin.password).not.toBe(DATOS.password);
      expect(await admin.validarPassword(DATOS.password)).toBe(true);
    });

    it('no debería duplicar ni modificar un usuario que ya existe', async () => {
      const primero = await asegurarAdministrador(DATOS);

      const segundo = await asegurarAdministrador({ ...DATOS, password: 'OtraClave123!' });

      const admin = await User.findByPk(primero.id);
      expect(segundo).toEqual({ creado: false, id: primero.id });
      expect(await User.count()).toBe(1);
      expect(await admin.validarPassword(DATOS.password)).toBe(true);
    });

    it('debería fallar si falta el email o la contraseña', async () => {
      await expect(asegurarAdministrador({ email: DATOS.email })).rejects.toThrow(/email y password/);
    });
  });
});
