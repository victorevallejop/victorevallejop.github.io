'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const carga = window.cargaCurso;
  const BACKEND_URL = String(window.EST001A_CONFIG?.backendUrl || '').trim().replace(/\/+$/, '');
  const query = new URLSearchParams(window.location.search);
  const IS_DEMO = !BACKEND_URL || query.get('demo') === '1';
  const TOKEN_KEY = 'est001a-sesion-v3';
  const DEMO_KEY = 'est001a-grupo11-demo-local-v4';
  // La simulación local usa cuatro fichas sintéticas independientes del curso.
  const DATA_DEMO = Array.from({length: 4}, (_, indice) => {
    const numero = String(98000000 + indice + 1);
    return {numero, dv: expectedDV(numero), nombre: 'Integrante de demostración ' + (indice + 1)};
  });
  const CASES = [
    'Seúl · Sistema de bicicletas compartidas',
    'Minnesota · Tráfico en la autopista I-94',
    'Corea del Sur · Consumo energético de acería',
    'Tetuán · Demanda eléctrica por zona',
    'Ingeniería civil · Resistencia del hormigón',
    'Comercio electrónico · Sesiones de navegación',
    'Educación · Resultados académicos en Portugal',
    'Servicios financieros · Contactos telefónicos bancarios',
    'Medioambiente · Calidad del aire en Pekín',
    'Laboratorio enológico · Vinos blancos portugueses',
  ];
  const state = {actor:null,login:null,challengeId:null,token:null,groups:[],groupSize:4,myGroup:null,record:null};
  const cleanNumber = value => String(value ?? '').replace(/\D/g,'').slice(0,8);
  const cleanDV = value => String(value ?? '').toUpperCase().replace(/[^0-9K]/g,'').slice(0,1);
  function expectedDV(numero) {
    if (!/^[0-9]{6,8}$/.test(numero)) return null;
    let sum=0,multiplier=2;
    for (let i=numero.length-1;i>=0;i--) {
      sum += Number(numero[i])*multiplier;
      multiplier=multiplier===7?2:multiplier+1;
    }
    const result=11-(sum%11);
    return result===11?'0':result===10?'K':String(result);
  }
  function checkPair(numero,dv) {
    if(!/^[0-9]{6,8}$/.test(numero)) return 'El RUT debe contener entre 6 y 8 cifras, sin puntos ni guion.';
    if(!/^[0-9K]$/.test(dv)) return 'Ingresa un DV entre 0 y 9 o la letra K.';
    return expectedDV(numero)===dv ? null : 'El dígito verificador no corresponde al RUT.';
  }
  const joinRut = v => v.numero+v.dv;
  function message(text,type='error') {
    const box=$('flash');box.className=`message show ${type}`;box.textContent=String(text || 'Ha ocurrido un error inesperado');
  }
  function clearMessage() {$('flash').textContent='';$('flash').className='message';}
  function progress(step) {for(let n=1;n<=4;n++){const s=$(`step${n}`);s.classList.toggle('done',n<step);s.classList.toggle('now',n===step);}}
  function numberTag(n) {return String(n).padStart(2,'0');}
  function getDemoRecord(){try{return JSON.parse(localStorage.getItem(DEMO_KEY)||'null');}catch{return null;}}
  async function api(action, payload={}, token=null) {
    if(!BACKEND_URL) throw Error('No se ha configurado el backend');
    let res;
    try{
      res=await fetch(BACKEND_URL,{method:'POST',mode:'cors',cache:'no-store',
        headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
        body:JSON.stringify({action,...payload})});
    }catch{throw Error('No se pudo conectar al servidor de inscripción. Verifica tu conexión.');}
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.ok===false) throw Error(String(data.error||'Solicitud rechazada por el servidor'));
    return data;
  }
  function sampleState(actor) {
    const record=getDemoRecord();
    const group11Busy=!!record;
    const belongs=record?.ruts?.includes(joinRut(actor));
    return {ok:true,actor:{nombre:actor.nombre,numero:actor.numero,dv:actor.dv},myGroup:belongs?11:null,
      groups:[...CASES.map((title,i)=>({numero:i+1,titulo:title,descripcion:'Pendiente de incorporar la base de datos real.',disponible:false,motivo:'Sin base de datos'})),
        {numero:11,titulo:'Grupo 11 · Prueba técnica',descripcion:'PDF + base CSV sintética, 600 registros × 10 variables.',disponible:!group11Busy,motivo:group11Busy?'Número ya reservado':'Prueba'}]};
  }
  function renderBanner(){const n=$('modeNotice');
    if(IS_DEMO) {
      n.className='info-note test';
      n.textContent='Demostración local. Usa estas cuatro fichas de prueba: ' +
        DATA_DEMO.map(persona => persona.numero + '–' + persona.dv).join(', ') +
        '. Los envíos se simulan en este navegador.';
    }
    else {n.className='info-note';n.textContent='REGISTRO INSTITUCIONAL · Los estudiantes no pueden consultar la nómina del curso. Solo el servidor valida los RUT, el número del grupo y los envíos de correo.';}
  }
  async function requestCode(event){event.preventDefault();
    if (carga.activa) return;
    clearMessage();
    const numero=cleanNumber($('loginNumero').value),dv=cleanDV($('loginDV').value);
    $('loginNumero').value=numero;$('loginDV').value=dv;
    const bad=checkPair(numero,dv);if(bad)return message(bad);
    state.login={numero,dv};
    const terminar = carga.iniciar('Enviando código…', $('sendCodeBtn'), [$('loginNumero'), $('loginDV')]);
    try{
      if(IS_DEMO){state.actor=DATA_DEMO.find(s=>s.numero===numero&&s.dv===dv)||null;
        if(!state.actor)throw Error('Utiliza una de las cuatro fichas de demostración que aparecen al inicio del formulario.');
        state.challengeId='demostracion';}
      else {const data=await api('solicitar_codigo',{numero,dv});state.challengeId=data.challengeId;}
      $('authPanel').classList.add('hidden');$('otpPanel').classList.remove('hidden');
      progress(2);message(IS_DEMO?'Demostración: utiliza el código 123456. No se envió ningún mensaje.':
        'Si el RUT pertenece al curso, recibirás un código de verificación en tu correo registrado. Consulta también la carpeta de spam.','info');
      $('otpCode').focus();
    }catch(err){message(err.message);}finally{terminar();}
  }
  async function verifyCode(event){event.preventDefault();
    if (carga.activa) return;
    clearMessage();
    const code=$('otpCode').value.replace(/\D/g,'').slice(0,6); $('otpCode').value=code;
    if(!/^\d{6}$/.test(code))return message('El código debe tener seis dígitos.');
    const terminar = carga.iniciar('Verificando código…', $('verifyBtn'), [$('otpCode'), $('backLogin')]);
    try{
      if(IS_DEMO){if(code!=='123456')throw Error('Código incorrecto. En la demostración usa 123456.');}
      else {const data=await api('verificar_codigo',{challengeId:state.challengeId,code});state.token=data.token;sessionStorage.setItem(TOKEN_KEY,state.token);}
      terminar();
      await abrirInscripcion();
    }catch(err){message(err.message);}finally{terminar();}
  }
  function applyGroupSize(size) {
    state.groupSize = size === 3 ? 3 : 4;
    const last = document.querySelectorAll('.member-row')[3];
    last.classList.toggle('hidden', state.groupSize === 3);
    $('groupRule').textContent = state.groupSize === 3
      ? 'Ya hay 36 estudiantes inscritos. Los tres estudiantes que quedan pueden registrar juntos el último grupo.'
      : 'Para inscribirte, completa un grupo de cuatro. Si te faltan integrantes, busca compañeros del paralelo que aún estén formando grupo. Recurre al docente por Aula USM solo si ya agotaste esa posibilidad.';
  }
  function memberRows(){return [...document.querySelectorAll('.member-row')].slice(0,state.groupSize);}
  function readMembers(){return memberRows().map(row=>({
    numero:cleanNumber(row.querySelector('.member-number').value),dv:cleanDV(row.querySelector('.member-dv').value)
  }));}
  function updateRows(){let count=0;const known=new Set();
    const rows=memberRows();
    const vals=readMembers();
    rows.forEach((row,i)=>{
      const v=vals[i],blank=!v.numero&&!v.dv,err=checkPair(v.numero,v.dv),duplicated=!err&&known.has(joinRut(v));
      const status=row.querySelector('.dv-status');
      if(!err)known.add(joinRut(v));
      if(!err&&!duplicated){count++;status.textContent=i===0?'Verificado':'DV correcto';status.className='dv-status status-success';}
      else if(blank){status.textContent='Pendiente';status.className='dv-status status-neutral';}
      else if(duplicated){status.textContent='RUT repetido';status.className='dv-status status-error';}
      else{status.textContent=(v.numero.length>=6&&v.dv)?'DV incorrecto':'Incompleto';status.className='dv-status '+(v.numero.length>=6&&v.dv?'status-error':'status-neutral');}
    });
    $('counterText').textContent=`${count} de ${state.groupSize} RUT válidos`;
    const chosen=state.groups.find(g=>g.numero===Number($('groupSelect').value));
    $('registerBtn').disabled=carga.activa || !(count===state.groupSize && vals.length===state.groupSize && chosen?.disponible && $('acceptTerms').checked && !state.myGroup);
  }
  function renderGroups() {
    const old=$('groupSelect').value;
    const select=$('groupSelect');select.replaceChildren(new Option('Seleccionar número de grupo…',''));
    for(const group of state.groups){
      const suffix=group.disponible?'Disponible':group.motivo||'No disponible';
      const opt=new Option(`Grupo ${numberTag(group.numero)} · ${suffix}`,String(group.numero));
      opt.disabled=!group.disponible;select.add(opt);
    }
    if([...select.options].some(o=>o.value===old&&!o.disabled))select.value=old;
    renderAssignment();updateRows();
  }
  function renderAssignment(){const g=state.groups.find(x=>x.numero===Number($('groupSelect').value));
    $('assignmentName').textContent=g?.titulo||'Selecciona un grupo';
    $('assignmentHint').textContent=g ? `${g.descripcion||''} · Cada integrante recibirá tres vínculos protegidos.` :
      'Los archivos se distribuyen solamente al completar el registro.';
  }
  async function loadState(){const data=IS_DEMO?sampleState(state.actor):await api('estado',{},state.token);
    applyGroupSize(data.groupSize);
    state.actor=data.actor;state.groups=data.groups||[];state.myGroup=data.myGroup;
    progress(state.myGroup?4:3);
    if(state.myGroup){$('enrollment').classList.add('hidden');renderResult({grupo:state.myGroup,existing:true});return;}
    $('result').classList.add('hidden');$('enrollment').classList.remove('hidden');
    $('actorName').textContent=data.actor.nombre;
    const lead=document.querySelector('.member-row[data-index="0"]');
    lead.querySelector('.member-number').value=data.actor.numero;
    lead.querySelector('.member-dv').value=data.actor.dv;
    // Los integrantes 2-4 se introducen manualmente: no se revela quién está libre/ocupado.
    renderGroups();
  }
  async function abrirInscripcion() {
    const terminar = carga.iniciar('Cargando tu inscripción…');
    $('otpPanel').classList.add('hidden');
    $('authPanel').classList.add('hidden');
    $('authSection').classList.add('hidden');
    clearMessage();
    try {
      await loadState();
    } catch (err) {
      sessionStorage.removeItem(TOKEN_KEY);
      state.token = null;
      state.challengeId = null;
      $('otpCode').value = '';
      $('authSection').classList.remove('hidden');
      $('authPanel').classList.remove('hidden');
      progress(1);
      message(err.message + ' Solicita un código para volver a ingresar.');
    } finally {
      terminar();
      if (!$('enrollment').classList.contains('hidden')) updateRows();
    }
  }
  const controlesGrupo = () => $('enrollment').querySelectorAll('button, select, input');
  async function actualizarGrupos() {
    if (carga.activa) return;
    clearMessage();
    const terminar = carga.iniciar('Consultando disponibilidad…', $('refreshGroups'), controlesGrupo());
    try {
      await loadState();
      message('Disponibilidad actualizada.','info');
    } catch (err) { message(err.message); }
    finally { terminar(); updateRows(); }
  }
  async function register(){
    if (carga.activa) return;
    clearMessage();
    const integrantes=readMembers();
    if(integrantes.length!==state.groupSize)return message('Revisa la cantidad de integrantes.');
    const missing=integrantes.findIndex(v=>checkPair(v.numero,v.dv));
    if(missing>=0)return message(`Verifica el RUT–DV del integrante ${missing+1}.`);
    if(new Set(integrantes.map(joinRut)).size!==state.groupSize)return message('Los RUT deben ser distintos.');
    if(joinRut(integrantes[0])!==joinRut(state.actor))return message('El primer integrante debe ser el responsable autenticado.');
    const numeroGrupo=Number($('groupSelect').value);
    const group=state.groups.find(g=>g.numero===numeroGrupo);
    if(!group?.disponible)return message('Selecciona un grupo habilitado y disponible.');
    if(!$('acceptTerms').checked)return message('Debes confirmar que todos los integrantes conocen la inscripción.');
    const terminar = carga.iniciar('Registrando grupo…', $('registerBtn'), controlesGrupo());
    try{
      let result;
      if(IS_DEMO){
        if(getDemoRecord())throw Error('El Grupo 11 ya quedó reservado en esta demostración.');
        if(!integrantes.every(r=>DATA_DEMO.some(x=>joinRut(x)===joinRut(r))))
          throw Error('Uno o más RUT no forman parte de la nómina ficticia de prueba.');
        localStorage.setItem(DEMO_KEY,JSON.stringify({grupo:11,ruts:integrantes.map(joinRut),fecha:new Date().toISOString()}));
        result={grupo:11,correos:{simulados:5,enviados:0},aviso:'Demostración local: ninguna notificación fue enviada.'};
      }else result=await api('registrar',{numeroGrupo,integrantes},state.token);
      state.record=result;state.myGroup=result.grupo;
      $('enrollment').classList.add('hidden');progress(4);renderResult(result);
      $('result').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(err){message(err.message);
      if(!IS_DEMO)try{await loadState();}catch{}
    }finally{terminar();updateRows();}
  }
  function renderResult(result){$('result').classList.remove('hidden');
    $('resultTitle').textContent=result.existing?'Ya formas parte de un grupo':'Inscripción del grupo confirmada';
    $('resultDetail').textContent=`Grupo ${numberTag(result.grupo)} · Estadística Descriptiva · Paralelo 300.`;
    $('resultSummary').textContent=result.existing?'Este RUT ya se encuentra registrado. No puedes abrir un grupo adicional.':
      'La reserva del número de grupo y de sus integrantes ha quedado registrada.';
    const emails=$('resultEmails');
    $('materialsLink').hidden=IS_DEMO;
    if(IS_DEMO){emails.textContent='Simulación: cinco correos (cuatro integrantes y docente), sin envíos reales. El registro solo existe en este navegador.';
      $('previewMailBtn').classList.remove('hidden');$('demoReset').classList.remove('hidden');}
    else{emails.textContent=result.existing?'Consulta el correo enviado al momento de la inscripción original.':
      `Notificaciones aceptadas para envío: ${result.correos?.enviados??0}; ficticias omitidas: ${result.correos?.omitidos??0}; pendientes o fallidas: ${result.correos?.errores??0}. La entrega final depende del proveedor de correo.`;
      $('previewMailBtn').classList.add('hidden');$('demoReset').classList.add('hidden');}
  }
  function previewMail(){const record=getDemoRecord();if(!record)return message('Primero debes completar una inscripción de demostración.');
    const members=DATA_DEMO.filter(x=>record.ruts.includes(joinRut(x)));
    const memberList=members.map(x=>`- ${x.nombre}`).join('\n');
    $('modalText').textContent=`VISTA PREVIA / NO SE HA ENVIADO NINGÚN CORREO\n\nGrupo: 11 (prueba técnica)\n\nIntegrantes:\n${memberList}\n\nNotificaciones: 4 estudiantes y profesor.\n\nVínculos individuales al enunciado, la base de datos y la plantilla. Un código habilita los tres materiales durante 10 minutos.\n\nLa demostración local no envía correos.`;
    $('modal').classList.remove('hidden');$('closeModal').focus();
  }
  function resetDemo(){if(!IS_DEMO)return;
    if(!window.confirm('¿Reiniciar solamente la prueba local del Grupo 11? Esto no modifica registros de Supabase.'))return;
    localStorage.removeItem(DEMO_KEY);sessionStorage.removeItem(TOKEN_KEY);location.reload();
  }
  function init(){renderBanner();
    $('authForm').addEventListener('submit',requestCode);
    $('otpForm').addEventListener('submit',verifyCode);
    $('backLogin').addEventListener('click',()=>{$('otpPanel').classList.add('hidden');$('authPanel').classList.remove('hidden');$('otpCode').value='';state.challengeId=null;progress(1);clearMessage();});
    $('loginNumero').addEventListener('input',event=>{event.target.value=cleanNumber(event.target.value);});
    $('loginDV').addEventListener('input',event=>{event.target.value=cleanDV(event.target.value);});
    $('otpCode').addEventListener('input',event=>{event.target.value=String(event.target.value).replace(/\D/g,'').slice(0,6);});
    document.querySelectorAll('.member-row:not(.lead)').forEach(row=>{
      row.querySelector('.member-number').addEventListener('input',e=>{e.target.value=cleanNumber(e.target.value);updateRows();});
      row.querySelector('.member-dv').addEventListener('input',e=>{e.target.value=cleanDV(e.target.value);updateRows();});
    });
    $('groupSelect').addEventListener('change',()=>{renderAssignment();updateRows();});
    $('acceptTerms').addEventListener('change',updateRows);
    $('registerBtn').addEventListener('click',register);
    $('refreshGroups').addEventListener('click',actualizarGrupos);
    $('previewMailBtn').addEventListener('click',previewMail);
    $('demoReset').addEventListener('click',resetDemo);
    $('closeModal').addEventListener('click',()=>$('modal').classList.add('hidden'));
    $('modal').addEventListener('click',e=>{if(e.target===$('modal'))$('modal').classList.add('hidden');});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')$('modal').classList.add('hidden');});
    if(!IS_DEMO){
      const saved=sessionStorage.getItem(TOKEN_KEY);
      if(saved){state.token=saved;abrirInscripcion();}
    }
  }
  init();
  window.__EST001A_TEST__={expectedDV,checkPair,readMembers,IS_DEMO};
})();
