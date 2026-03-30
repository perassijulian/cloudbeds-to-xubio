- const q = encodeURIComponent('Consumidor Final');
const res = await xubioFetch(`/clienteBean?nombre=${q}`, { method: 'GET' });

cada cliente va a tener su cliente_id en xubio o se va a facturar todo a consumidor final?

- hay que cargar moneda
- hay que cargar provincia
- hay que cargar lista de precios
- hay que centro de costo

- fecha de vencimiento importa? hoy o a fin de mes?

-   const cantComprobantesEmitidos = 0;
  const cantComprobantesCancelados = 0;
  ?

-   const facturaNoExportacion = true; ?

- precio, iva, importe, total ?



PARA MI
- codigo y id de cliente?
