'use strict';
(() => {
  const region = document.getElementById('carga');
  let accion = null;

  function terminar() {
    if (!accion) return;
    const { boton, etiqueta, original, bloqueados } = accion;
    for (const control of bloqueados) control.disabled = false;
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
      if (etiqueta) etiqueta.textContent = original;
    }
    region.textContent = '';
    region.classList.remove('carga-en-boton');
    accion = null;
  }

  function iniciar(texto, boton = null, controles = []) {
    const etiqueta = boton && (boton.querySelector('[data-etiqueta]') || (!boton.children.length && boton));
    const bloqueados = Array.from(controles).filter(control => control !== boton && !control.disabled);
    for (const control of bloqueados) control.disabled = true;
    accion = { boton, etiqueta, original: etiqueta?.textContent, bloqueados };
    if (boton) {
      boton.disabled = true;
      boton.setAttribute('aria-busy', 'true');
      if (etiqueta) etiqueta.textContent = texto;
    }
    region.classList.toggle('carga-en-boton', Boolean(etiqueta));
    region.textContent = texto;
    const actual = accion;
    return () => { if (accion === actual) terminar(); };
  }

  window.cargaCurso = { iniciar, terminar, get activa() { return accion !== null; } };
})();
