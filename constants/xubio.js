export const circuitoContableDefault = { ID: -2, nombre: 'default', codigo: 'DEFAULT', id: -2 }

export const puntoVenta00003 = {
      puntoVentaId: 209363,
      nombre: 'LOS CALAFATES',
      codigo: 'LOS_CALAFATES',
      puntoVenta: '00003',
      modoNumeracion: 'automatico',
      circuitoContable: circuitoContableDefault,
      activo: 1,
      factElectronicaConXB: 1
    }

// el unico que tenemos registrado
export const depositoUniversal = {
    codigo: 'DEPOSITO_UNIVERSAL',
    nombre: 'Depósito Universal',
    id: -2,
    ID: -2
  }

export const monedaPesosArgentinos = {
    moneda_id: -2,
    codigo: 'PESOS_ARGENTINOS',
    nombre: 'Pesos Argentinos'
  }

export const provinciaTierraDelFuego = {
    provincia_id: 23,
    codigo: 'TIERRA_DEL_FUEGO',
    nombre: 'Tierra del Fuego',
    pais: 'Argentina'
  }

export const bancoTierraDelFuego = { banco_id: 21, codigo: 'TDF', nombre: 'Banco de Tierra del Fuego' }

export const listaDePrecioGenerica = {
    listaPrecioID: 17794,
    activo: true,
    nombre: "Lista de precio",
    descripcion: "Alquiler habitaciones",
    esDefault: true,
    moneda: monedaPesosArgentinos,
    tipo: 1,
    iva: 0,
    ocultarSinPrecio: true
  }

export const centroDeCostoGenerico = {
  "ID": 0,
  "nombre": "Centro de Costo Generico",
  "codigo": "CENTRO_DE_COSTO_GENERICO",
  "id": 0
}

export const vendedorGenerico = {
  vendedorId: 1,
  nombre: "hernan",
  apellido: "Virtual",
  esVendedor: 1,
  activo: 1
}

export const unidadMedida = {
    codigo: "07",
    nombre: "Unidad (U)",
    ID: 1
}