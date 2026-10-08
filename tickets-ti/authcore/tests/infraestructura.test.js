const { errorHandler } = require('../src/middlewares/errorHandler');
const { requerirEnv } = require('../src/config/env');
const { AppError } = require('../src/utils/AppError');

const resFalso = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('errorHandler', () => {
  it('debería traducir AppError a { success: false, message, errors }', () => {
    const res = resFalso();
    errorHandler(new AppError(404, 'No encontrado'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No encontrado', errors: [] });
  });

  it('debería responder 400 con los campos de un error de validación de Sequelize', () => {
    const res = resFalso();
    const err = { name: 'SequelizeUniqueConstraintError', errors: [{ path: 'email', message: 'email must be unique' }] };
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors).toEqual([{ field: 'email', message: 'email must be unique' }]);
  });

  it('no debería filtrar el mensaje interno en un error 500', () => {
    const res = resFalso();
    const espia = jest.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('detalle interno de la BD'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Error interno del servidor', errors: [] });
    espia.mockRestore();
  });
});

describe('requerirEnv', () => {
  it('debería lanzar si la variable no existe', () => {
    expect(() => requerirEnv('VARIABLE_QUE_NO_EXISTE_EN_TEST')).toThrow(/VARIABLE_QUE_NO_EXISTE_EN_TEST/);
  });

  it('debería lanzar si la variable está vacía', () => {
    process.env.VARIABLE_VACIA_TEST = '';
    expect(() => requerirEnv('VARIABLE_VACIA_TEST')).toThrow();
    delete process.env.VARIABLE_VACIA_TEST;
  });

  it('debería devolver el valor si existe', () => {
    expect(requerirEnv('NODE_ENV')).toBe('test');
  });
});
