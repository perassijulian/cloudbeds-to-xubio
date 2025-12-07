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
  "listaPrecioID": 0,
  "activo": true,
  "nombre": "Lista de Precio Generica",
  "descripcion": "Lista de Precio Generica",
  "esDefault": true,
  "moneda": monedaPesosArgentinos,
  "tipo": 0,
  "iva": 0,
  "listaReferencia": null,
  "listaPrecioItem": [
    // {
    //   "listaPrecioID": 0,
    //   "producto": {
    //     "ID": 0,
    //     "nombre": "Producto al 21%",
    //     "codigo": "string",
    //     "id": 0
    //   },
    //   "precio": 0,
    //   "codigo": "string",
    //   "referencia": 0
    // }
  ],
  "ocultarSinPrecio": true
}

export const centroDeCostoGenerico = {
  "ID": 0,
  "nombre": "Centro de Costo Generico",
  "codigo": "CENTRO_DE_COSTO_GENERICO",
  "id": 0
}

export const vendedorGenerico = {
  vendedorId: 1,
  nombre: "Vendedor",
  apellido: "Virtual",
  esVendedor: 1,
  activo: 1
}