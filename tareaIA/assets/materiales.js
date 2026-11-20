'use strict';
(() => {
  const id = x => document.getElementById(x);
  const types = {enunciado:'Enunciado de la tarea',datos:'Base de datos',plantilla:'Plantilla de desarrollo'};
  const selected = new URLSearchParams(location.search).get('archivo');
  let pending = Object.hasOwn(types,selected) ? selected : null;
  const key = 'est001a-materiales-202602-p300';
  const url = window.EST001A_CONFIG?.backendUrl;
  let session, challenge, timer;
  const carga = window.cargaCurso;
  const status = text => { id('status').textContent = text; };
  const show = name => ['identity','verification','choices'].forEach(x => { id(x).hidden = x !== name; });
  const read = () => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const active = s => s && /^[0-9a-f]{64}$/.test(s.token) && Date.parse(s.expiresAt) > Date.now();
  const buttons = () => Array.from(document.querySelectorAll('#choices button[data-type]'));
  function save(s) {
    session = s;
    try { if (s) localStorage.setItem(key,JSON.stringify(s)); else localStorage.removeItem(key); } catch { /* La pestaña conserva el acceso en memoria. */ }
  }
  function login(message) {
    clearTimeout(timer);
    session = null;
    challenge = null;
    id('code').value = '';
    id('heading').textContent = pending ? types[pending] : 'Materiales de mi grupo';
    id('hint').textContent = 'Ingresa tu RUT para recibir un código en tu correo registrado.';
    show('identity');
    status(message || '');
  }
  function ready(s) {
    clearTimeout(timer);
    session = s;
    show('choices');
    id('heading').textContent = 'Materiales de mi grupo';
    const until = new Date(s.expiresAt).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    id('hint').textContent = 'Puedes descargar los tres archivos hasta las ' + until + ' (hora de tu dispositivo).';
    timer = setTimeout(() => {
      const latest = read();
      if (active(latest)) return ready(latest);
      carga.terminar();
      save(null);
      login('El acceso venció. Solicita otro código para continuar.');
    },Math.max(1,Date.parse(s.expiresAt)-Date.now()));
  }
  async function api(action,payload,token) {
    if (!url) throw Error('El portal de materiales aún no está configurado.');
    const headers = {'Content-Type':'application/json'};
    if (token) headers.Authorization = 'Bearer ' + token;
    let r;
    try {
      r = await fetch(url,{method:'POST',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',headers,body:JSON.stringify({action,...payload})});
    } catch { throw Error('No se pudo conectar. Revisa tu conexión e inténtalo nuevamente.'); }
    if (!r.ok) {
      const info = await r.json().catch(() => ({}));
      const error = Error(info.error || 'La solicitud no se pudo completar.');
      error.status = r.status;
      throw error;
    }
    return r;
  }
  async function download(type) {
    if (carga.activa) return;
    const s = read() || session;
    if (!active(s)) { pending = type; save(null); return login('Solicita un código para descargar este material.'); }
    const archivos = buttons();
    const boton = archivos.find(b => b.dataset.type === type);
    const terminar = carga.iniciar('Preparando descarga…', boton, [...archivos, id('end')]);
    status('');
    try {
      const r = await api('descargar_material',{tipo:type},s.token);
      const file = await r.blob();
      if (session?.token !== s.token || !active(s)) return;
      const href = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = href;
      a.download = /filename="([A-Za-z0-9_.-]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || types[type];
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href),60000);
      status('Descarga iniciada. Puedes elegir otro archivo de tu grupo.');
    } catch (e) {
      if (session?.token !== s.token) return;
      if (e.status === 401) { pending = type; if (read()?.token === s.token) save(null); login('El acceso venció. Solicita otro código.'); }
      else status(e.message);
    } finally { terminar(); }
  }
  id('identity').addEventListener('submit',async e => {
    e.preventDefault();
    if (carga.activa) return;
    const numero = id('numero').value.trim(), dv = id('dv').value.toUpperCase();
    const terminar = carga.iniciar('Enviando código…', id('pedir'), [id('numero'), id('dv')]);
    status('');
    try {
      const r = await api('solicitar_codigo_materiales',{numero,dv});
      const data = await r.json();
      if (id('identity').hidden) return;
      challenge = data.challengeId;
      show('verification');
      id('hint').textContent = 'Si tu RUT pertenece al curso, recibirás un código de un solo uso. Tienes 10 minutos para ingresarlo.';
      status('');
      id('code').focus();
    } catch (err) { if (!id('identity').hidden) status(err.message); } finally { terminar(); }
  });
  id('verification').addEventListener('submit',async e => {
    e.preventDefault();
    if (carga.activa) return;
    const reto = challenge;
    const terminar = carga.iniciar('Verificando código…', id('verificar'), [id('code'), id('back')]);
    status('');
    try {
      const r = await api('verificar_codigo_materiales',{challengeId:reto,code:id('code').value});
      const {token,expiresAt} = await r.json();
      if (id('verification').hidden || challenge !== reto) return;
      const s = {token,expiresAt};
      if (!active(s)) throw Error('No se pudo iniciar el acceso a los materiales.');
      id('code').value = ''; challenge = null;
      save(s); ready(s); status('');
      terminar();
      if (pending) await download(pending);
    } catch (err) { if (!id('verification').hidden) status(err.message); } finally { terminar(); }
  });
  id('back').addEventListener('click',() => login(''));
  id('end').addEventListener('click',async () => {
    if (carga.activa) return;
    const s = session;
    const terminar = carga.iniciar('Cerrando acceso…', id('end'), buttons());
    status('');
    try {
      if (active(s)) await api('cerrar_materiales',{},s.token);
      if (session !== s) return;
      save(null); login('Has cerrado el acceso en este navegador.');
    } catch (err) { if (session === s) status(err.message); } finally { terminar(); }
  });
  buttons().forEach(b => b.addEventListener('click',() => download(b.dataset.type)));
  window.addEventListener('storage',e => {
    if (e.key !== key) return;
    carga.terminar();
    const s = read();
    if (active(s)) { ready(s); status('Ya puedes descargar tus materiales.'); }
    else login('Identifícate para descargar.');
  });
  const s = read();
  if (active(s)) { ready(s); if (pending) download(pending); }
  else { save(null); login(''); }
})();
