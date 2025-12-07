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
    centroDeCosto_id: 65423,
    codigo: "CALAFATES",
    nombre: "Calafates"
  }

export const vendedorGenerico = {
  vendedorId: 12408,
  // nombre: "Calafates",
  // apellido: "Virtual",
  activo: 1
}

export const unidadMedida = {
    codigo: "07",
    nombre: "Unidad (U)",
    ID: 1
}

export const clienteDelExterior = {
cliente_id: 9609137,
nombre: "Cliente del exterior"
}

export const productoAlojamiento = {
    productoid: 2994435,
    nombre: "Alojamiento",
    codigo: "ALOJAMIENTO",
    usrcode: "",
    codigoBarra: "",
    unidadMedida: unidadMedida,
    categoria: 1,
    stockNegativo: false,
    // tasaIva: {
    //   ID: 8,
    //   nombre: "Iva No Gravado",
    //   codigo: "IVANOGRAVADO",
    //   id: 8
    // },
    // cuentaContable: {
    //   ID: -15,
    //   nombre: "Venta de Servicios",
    //   codigo: "VENTA_DE_SERVICIOS",
    //   id: -15
    // },
    catFormIVA2002: -1,
    precioUltCompra: 0,
    activo: 1,
    sincronizaStock: 0,
    tipoOperacionIvaSimple: -1
  }

export const cuenta = {
    codigo: "CAJA",
    nombre: "Caja",
    id: -13,
    ID: -13
  }