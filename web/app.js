(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const I18n=window.SwapUpI18n;
  const colors = ['#6757e8','#ff7580','#32a58c','#f2a93b','#3d8ee8','#a34fcb','#e55c9a','#667085'];
  const defaults = [
    {id:'pessoal',name:'Pessoal',color:'#6757e8'}, {id:'trabalho',name:'Trabalho',color:'#3d8ee8'},
    {id:'saude',name:'Saúde',color:'#32a58c'}, {id:'importante',name:'Importante',color:'#ff7580'}
  ];
  const defaultSettings = {language:'pt-BR',startView:'month',autostart:true,confirmDelete:true,theme:'light',accent:'#6757e8',compact:false,reduceMotion:false,fontScale:1,highContrast:false,reduceTransparency:false,showInsight:true,weekStart:0,timeFormat:'24',duration:60,defaultReminder:15,defaultCategory:'pessoal',notifications:true,notifyLocation:true,calendarSystem:'gregory'};
  const defaultProfile = {name:'Eu',role:'Uso pessoal',photo:''};
  const accentMap = {'#6757e8':'#8c63ee','#3d8ee8':'#62a9f4','#32a58c':'#50c8a9','#e55c9a':'#f17ab7','#f26c52':'#ff917b','#a34fcb':'#c278e6'};
  let state = load();
  let cursor = new Date(); cursor.setHours(12,0,0,0);
  let selectedDate = iso(new Date());
  let currentView = state.settings.startView;
  let agendaOffset = 0;
  let query = '';
  let chosenColor = colors[0];

  function load(){
    try { const v=JSON.parse(localStorage.getItem('swapup-data')); if(v?.version){const settings={...defaultSettings,...(v.settings||{})};if(v.version===1&&!v.settings)settings.theme='light';return {...v,version:3,filters:v.filters||{},settings,profile:{...defaultProfile,...(v.profile||{})}};} } catch{}
    return {version:3,categories:defaults,events:[],filters:{},settings:{...defaultSettings},profile:{...defaultProfile},createdAt:new Date().toISOString()};
  }
  function save(){ localStorage.setItem('swapup-data',JSON.stringify(state)); }
  function iso(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function parseDate(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d,12); }
  function esc(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function cap(s){ return s ? s[0].toLocaleUpperCase(I18n.locale)+s.slice(1) : s; }
  function calendarLocale(locale=I18n.locale){return `${locale}-u-ca-${state.settings.calendarSystem}`;}
  function monthText(date){return new Intl.DateTimeFormat(calendarLocale(),{month:'long',year:'numeric'}).format(date);}
  function dayText(date){return new Intl.DateTimeFormat(calendarLocale(),{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(date);}
  function shortDayText(date){return new Intl.DateTimeFormat(calendarLocale(),{weekday:'short',day:'numeric',month:'short'}).format(date);}
  function calendarParts(date){const parts=new Intl.DateTimeFormat(`en-u-ca-${state.settings.calendarSystem}-nu-latn`,{year:'numeric',month:'numeric',day:'numeric',era:'short'}).formatToParts(date);const out={};for(const part of parts)if(['year','relatedYear','month','day','era'].includes(part.type))out[part.type]=part.value;return out;}
  function calendarMonthId(date){const p=calendarParts(date);return `${p.era||''}|${p.relatedYear||p.year||''}|${p.month||''}`;}
  function calendarDayNumber(date){return new Intl.DateTimeFormat(calendarLocale(),{day:'numeric'}).format(date);}
  function calendarMonthFirst(base){const date=new Date(base);date.setHours(12,0,0,0);for(let i=0;i<40;i++){if(Number(calendarParts(date).day)===1)return date;date.setDate(date.getDate()-1);}return new Date(base.getFullYear(),base.getMonth(),1,12);}
  function stepCalendarMonth(direction){const first=calendarMonthFirst(cursor);if(direction<0){first.setDate(first.getDate()-1);cursor=first;return;}const id=calendarMonthId(first),date=new Date(first);for(let i=1;i<42;i++){date.setDate(date.getDate()+1);if(calendarMonthId(date)!==id){cursor=date;return;}}}
  function weekdayLabels(width){const base=new Date(2024,0,7+Number(state.settings.weekStart),12);return Array.from({length:7},(_,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);return new Intl.DateTimeFormat(I18n.locale,{weekday:width}).format(d);});}
  function initials(name){ const parts=(name||'Eu').trim().split(/\s+/).filter(Boolean);return (parts.length>1?parts[0][0]+parts.at(-1)[0]:parts[0]?.slice(0,2)||'EU').toLocaleUpperCase('pt-BR'); }
  function setAvatarContent(element,name,photo){if(photo){element.innerHTML=`<img src="${esc(photo)}" alt="">`;element.classList.add('has-photo');}else{element.textContent=initials(name);element.classList.remove('has-photo');}}
  function renderProfileAvatars(){const name=state.profile.name||'Meu perfil';$$('.avatar,.profile-avatar').forEach(element=>setAvatarContent(element,name,state.profile.photo));$('#menuProfileName').textContent=name;}
  function formatTime(value){ if(!value||state.settings.timeFormat==='24')return value;const[h,m]=value.split(':').map(Number);return `${(h%12)||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`; }
  function mixColor(a,b,amount){const parse=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));const x=parse(a),y=parse(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*amount).toString(16).padStart(2,'0')).join('');}
  function applyPreferences(){
    I18n.setLanguage(state.settings.language);
    const requested=state.settings.theme, dark=requested==='dark'||(requested==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.setProperty('--purple',state.settings.accent);document.documentElement.style.setProperty('--purple2',accentMap[state.settings.accent]||mixColor(state.settings.accent,'#ffffff',.24));
    document.documentElement.style.setProperty('--font-scale',String(Number(state.settings.fontScale)||1));
    document.body.classList.toggle('compact',!!state.settings.compact);document.body.classList.toggle('reduce-motion',!!state.settings.reduceMotion);document.body.classList.toggle('high-contrast',!!state.settings.highContrast);document.body.classList.toggle('reduce-transparency',!!state.settings.reduceTransparency);document.body.classList.toggle('no-insight',state.settings.showInsight===false);$('#insightCard').classList.toggle('hidden',state.settings.showInsight===false);
    post({type:'setWindowTheme',dark,accent:state.settings.accent});
    renderProfileAvatars();
    post({type:'setLanguage',strings:{open:I18n.t('Abrir SwapUp!'),newEvent:I18n.t('Novo evento'),exit:I18n.t('Sair'),windowTitle:I18n.t('Seu calendário'),trayTitle:I18n.t('SwapUp! continua ativo'),trayBody:I18n.t('Seus lembretes ficam funcionando na bandeja. Clique duas vezes no ícone para abrir.'),duplicate:I18n.t('O SwapUp! já está aberto na bandeja do sistema.')}});
  }
  function cat(id){ return state.categories.find(c=>c.id===id)||state.categories[0]||{name:'Pessoal',color:'#6757e8'}; }
  function daysBetween(a,b){ return Math.round((new Date(b.getFullYear(),b.getMonth(),b.getDate())-new Date(a.getFullYear(),a.getMonth(),a.getDate()))/86400000); }
  function occursOn(ev,date){
    const start=parseDate(ev.date), diff=daysBetween(start,date); if(diff<0) return false;
    if(!ev.repeat||ev.repeat==='none') return diff===0;
    if(ev.repeat==='daily') return true;
    if(ev.repeat==='weekly') return diff%7===0;
    if(ev.repeat==='monthly') return start.getDate()===date.getDate();
    if(ev.repeat==='yearly') return start.getDate()===date.getDate()&&start.getMonth()===date.getMonth();
    return false;
  }
  function eventsOn(date){
    return state.events.filter(e=>occursOn(e,date)&&state.filters[e.category]!==false&&(!query||`${e.title} ${e.location||''} ${e.notes||''}`.toLowerCase().includes(query)))
      .sort((a,b)=>(a.allDay?'00:00':a.startTime).localeCompare(b.allDay?'00:00':b.startTime));
  }
  function render(){renderCategories();renderMini();renderInsight();if(currentView==='month')renderMonth();else if(currentView==='week')renderTimeline('week');else if(currentView==='day')renderTimeline('day');else renderAgenda();I18n.apply(document);}
  function renderCategories(){
    $('#categoryFilters').innerHTML=state.categories.map(c=>`<div class="category-filter-row"><label class="category-filter"><input type="checkbox" data-filter="${esc(c.id)}" ${state.filters[c.id]!==false?'checked':''}><i style="background:${c.color}"></i><span>${esc(c.name)}</span></label><button type="button" class="category-delete-hover" data-delete-calendar="${esc(c.id)}" title="${esc(I18n.t('Excluir calendário'))}" aria-label="${esc(I18n.t('Excluir calendário'))}" ${state.categories.length===1?'disabled':''}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.8 11H7.8L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg></button></div>`).join('');
    $('#category').innerHTML=state.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    $('#settingDefaultCategory').innerHTML=state.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    $$('[data-filter]').forEach(el=>el.onchange=()=>{state.filters[el.dataset.filter]=el.checked;save();render();});
    $('#categoryFilters').querySelectorAll('[data-delete-calendar]').forEach(button=>button.onclick=()=>deleteCalendar(button.dataset.deleteCalendar));
  }
  function monthCells(base){const first=calendarMonthFirst(base),start=new Date(first),offset=(first.getDay()-Number(state.settings.weekStart)+7)%7;start.setDate(first.getDate()-offset);return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});}
  function renderMini(){
    const all=monthCells(cursor),currentId=calendarMonthId(cursor),needsSix=all.slice(35).some(d=>calendarMonthId(d)===currentId),shown=needsSix?all:all.slice(0,35);
    const labels=weekdayLabels('narrow');
    $('#miniCalendar').innerHTML=`<div class="mini-head"><span>${esc(monthText(cursor))}</span><span>●</span></div><div class="mini-week">${labels.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="mini-days">${shown.map(d=>`<span class="mini-day ${calendarMonthId(d)!==currentId?'other':''} ${iso(d)===iso(new Date())?'today':''} ${eventsOn(d).length?'has':''}" data-mini-date="${iso(d)}">${esc(calendarDayNumber(d))}</span>`).join('')}</div>`;
    $$('[data-mini-date]').forEach(x=>x.onclick=()=>{selectedDate=x.dataset.miniDate;cursor=parseDate(selectedDate);render();});
  }
  function renderMonth(){
    $('#periodTitle').textContent=cap(monthText(cursor)); const today=iso(new Date());
    const labels=weekdayLabels('short');$('.weekdays').innerHTML=labels.map(x=>`<span>${esc(x.toLocaleUpperCase(I18n.locale))}</span>`).join('');
    const currentId=calendarMonthId(cursor);$('#calendarGrid').innerHTML=monthCells(cursor).map(d=>{const list=eventsOn(d),date=iso(d);return `<div class="day-cell ${calendarMonthId(d)!==currentId?'other':''} ${date===today?'today':''} ${date===selectedDate?'selected':''}" data-date="${date}"><span class="day-number">${esc(calendarDayNumber(d))}</span><div class="events">${list.slice(0,3).map(e=>{const c=cat(e.category);return `<button class="event-pill" data-event="${e.id}" style="--event-color:${c.color}"><b>${e.allDay?'':esc(formatTime(e.startTime))+' '}</b>${esc(e.title)}</button>`}).join('')}${list.length>3?`<span class="more-events">+${list.length-3} ${esc(I18n.t('eventos'))}</span>`:''}</div></div>`}).join('');
    $$('.day-cell').forEach(x=>x.onclick=e=>{ if(e.target.closest('[data-event]'))return; selectedDate=x.dataset.date;openNew(selectedDate); });
    $$('[data-event]').forEach(x=>x.onclick=e=>{e.stopPropagation();openEdit(x.dataset.event);});
  }
  function weekStartDate(date){const start=new Date(date),offset=(start.getDay()-Number(state.settings.weekStart)+7)%7;start.setDate(start.getDate()-offset);start.setHours(12,0,0,0);return start;}
  function renderTimeline(mode){
    const base=parseDate(selectedDate),first=mode==='week'?weekStartDate(base):base,dates=Array.from({length:mode==='week'?7:1},(_,i)=>{const d=new Date(first);d.setDate(first.getDate()+i);return d;}),today=iso(new Date());
    const startHour=0,endHour=24,hourCount=24,target=mode==='week'?$('#weekView'):$('#dayView');
    $('#periodTitle').textContent=mode==='week'?`${shortDayText(dates[0])} — ${shortDayText(dates.at(-1))}`:cap(dayText(base));
    const heads=dates.map(d=>`<span class="${iso(d)===today?'timeline-today':''}">${esc(new Intl.DateTimeFormat(calendarLocale(),{weekday:'short'}).format(d))}<b>${esc(calendarDayNumber(d))}</b></span>`).join('');
    const allDay=dates.map(d=>`<div class="all-day-cell">${eventsOn(d).filter(e=>e.allDay).map(e=>{const c=cat(e.category);return `<button class="all-day-event" data-event="${e.id}" style="--event-color:${c.color}">${esc(e.title)}</button>`}).join('')}</div>`).join('');
    const columns=dates.map(d=>{const date=iso(d),timed=eventsOn(d).filter(e=>!e.allDay),slots=Array.from({length:hourCount},(_,i)=>`<div class="timeline-hour-slot" data-timeline-date="${date}" data-hour="${startHour+i}"></div>`).join('');const blocks=timed.map(e=>{const c=cat(e.category),[sh,sm]=(e.startTime||'00:00').split(':').map(Number),[eh,em]=(e.endTime||e.startTime||'00:00').split(':').map(Number),startMinutes=sh*60+sm,endMinutes=Math.max(startMinutes+15,eh*60+em),top=Math.max(0,(startMinutes-startHour*60)/60*64),bottom=Math.min(hourCount*64,(endMinutes-startHour*60)/60*64),height=Math.max(24,bottom-top);if(startMinutes>=endHour*60||endMinutes<=startHour*60)return '';return `<button class="timeline-event" data-event="${e.id}" style="--event-color:${c.color};top:${top}px;height:${height}px"><b>${esc(e.title)}</b><small>${esc(formatTime(e.startTime))}–${esc(formatTime(e.endTime))}${e.location?' · '+esc(e.location):''}</small></button>`}).join('');const now=new Date(),nowMinutes=now.getHours()*60+now.getMinutes(),line=date===today&&nowMinutes>=startHour*60&&nowMinutes<=endHour*60?`<i class="current-time-line" style="top:${(nowMinutes-startHour*60)/60*64}px"></i>`:'';return `<div class="timeline-day-column">${slots}${blocks}${line}</div>`}).join('');
    const timeLabels=Array.from({length:hourCount},(_,i)=>`<div class="time-label">${esc(formatTime(`${String(startHour+i).padStart(2,'0')}:00`))}</div>`).join('');
    target.style.setProperty('--day-count',dates.length);target.style.setProperty('--hour-count',hourCount);target.innerHTML=`<div class="timeline-header" style="--day-count:${dates.length}"><span></span>${heads}</div><div class="all-day-grid" style="--day-count:${dates.length}"><div class="all-day-label">Dia inteiro</div>${allDay}</div><div class="timeline-scroll"><div class="timeline-body" style="--day-count:${dates.length};--hour-count:${hourCount}"><div class="time-axis">${timeLabels}</div>${columns}</div></div>`;
    $$('[data-timeline-date]').forEach(slot=>slot.onclick=()=>{const hour=Number(slot.dataset.hour);openNew(slot.dataset.timelineDate,`${String(hour).padStart(2,'0')}:00`);});target.querySelectorAll('[data-event]').forEach(button=>button.onclick=e=>{e.stopPropagation();openEdit(button.dataset.event);});
    const scroll=target.querySelector('.timeline-scroll'),now=new Date(),preferred=Math.max(startHour,Math.min(endHour-1,now.getHours()))-startHour;if(scroll)scroll.scrollTop=Math.max(0,preferred*64-100);
  }
  function agendaInstances(days=120,startOffset=0){
    const out=[],start=new Date();start.setHours(12,0,0,0);
    start.setDate(start.getDate()+startOffset);
    for(let i=0;i<days;i++){const d=new Date(start);d.setDate(start.getDate()+i);const es=eventsOn(d);if(es.length)out.push({date:d,events:es});}
    return out;
  }
  function renderAgenda(){
    const rangeStart=new Date();rangeStart.setDate(rangeStart.getDate()+agendaOffset);const rangeEnd=new Date(rangeStart);rangeEnd.setDate(rangeStart.getDate()+119);
    $('#periodTitle').textContent=agendaOffset===0?'Próximos eventos':`${cap(monthText(rangeStart))} — ${cap(monthText(rangeEnd))}`; const groups=agendaInstances(120,agendaOffset);
    $('#agendaView').innerHTML=groups.length?groups.map(g=>`<article class="agenda-day"><h3>${esc(cap(dayText(g.date)))}</h3>${g.events.map(e=>{const c=cat(e.category);return `<div class="agenda-item"><time>${e.allDay?'Dia inteiro':esc(formatTime(e.startTime))}</time><i class="agenda-line" style="background:${c.color}"></i><div><h4>${esc(e.title)}</h4><p>${esc(c.name)}${e.location?' · '+esc(e.location):''}</p></div><button class="ghost" data-event="${e.id}">Editar</button></div>`}).join('')}</article>`).join(''):`<article class="agenda-day"><h3>Nenhum evento neste período</h3><p style="color:#888;font-size:12px">Sua agenda está tranquila. Adicione seu próximo compromisso.</p></article>`;
    $$('[data-event]').forEach(x=>x.onclick=()=>openEdit(x.dataset.event));
  }
  function nextInstance(){ const now=new Date(); for(const g of agendaInstances(366)){for(const e of g.events){const at=new Date(g.date);if(!e.allDay){const[h,m]=(e.startTime||'00:00').split(':').map(Number);at.setHours(h,m,0,0)}else at.setHours(0,0,0,0);if(at>=now)return{e,at};}} return null; }
  function renderInsight(){ const n=nextInstance(); if(!n){$('#nextEventTitle').textContent='Sua agenda está livre';$('#nextEventMeta').textContent='Aproveite o tempo ou planeje algo novo.';return;} const c=cat(n.e.category);$('#nextEventTitle').textContent=n.e.title;$('#nextEventMeta').textContent=`${dayText(n.at)} · ${n.e.allDay?'Dia inteiro':formatTime(n.e.startTime)}${n.e.location?' · '+n.e.location:''} · ${c.name}`; }
  function openNew(date=selectedDate,startOverride='09:00'){
    const start=startOverride,[startHour,startMinute]=start.split(':').map(Number),endMinutes=Math.min(23*60+59,startHour*60+startMinute+Number(state.settings.duration)),end=`${String(Math.floor(endMinutes/60)).padStart(2,'0')}:${String(endMinutes%60).padStart(2,'0')}`;
    $('#eventForm').reset();$('#eventId').value='';$('#eventDate').value=date||iso(new Date());$('#startTime').value=start;$('#endTime').value=end;$('#reminder').value=String(state.settings.defaultReminder);$('#category').value=state.settings.defaultCategory;$('#repeat').value='none';$('#modalEyebrow').textContent=I18n.t('NOVO COMPROMISSO');$('#modalTitle').textContent=I18n.t('Adicionar evento');$('#deleteBtn').classList.add('hidden');setTimeFields();show('#eventModal');setTimeout(()=>$('#eventTitle').focus(),80);
  }
  function openEdit(id){ const e=state.events.find(x=>x.id===id);if(!e)return;openNew(e.date);$('#eventId').value=e.id;$('#eventTitle').value=e.title;$('#eventDate').value=e.date;$('#allDay').checked=!!e.allDay;$('#startTime').value=e.startTime||'09:00';$('#endTime').value=e.endTime||'10:00';$('#location').value=e.location||'';$('#category').value=e.category;$('#reminder').value=String(e.reminder??15);$('#repeat').value=e.repeat||'none';$('#notes').value=e.notes||'';$('#modalEyebrow').textContent=I18n.t('EDITAR COMPROMISSO');$('#modalTitle').textContent=I18n.t('Editar evento');$('#deleteBtn').classList.remove('hidden');setTimeFields(); }
  function setTimeFields(){ $$('.time-field').forEach(x=>x.style.opacity=$('#allDay').checked?'.38':'1'); $('#startTime').disabled=$('#endTime').disabled=$('#allDay').checked; }
  function show(s){$(s).classList.remove('hidden')} function hide(s){$(s).classList.add('hidden')}
  let confirmResolver=null;
  function closeConfirm(result){if(!confirmResolver)return;const resolve=confirmResolver;confirmResolver=null;hide('#confirmModal');resolve(result);}
  function askConfirmation(title,message,confirmLabel='Excluir'){
    if(confirmResolver)closeConfirm(false);
    $('#confirmTitle').textContent=I18n.t(title);$('#confirmMessage').textContent=message;$('#confirmAcceptBtn').textContent=I18n.t(confirmLabel);I18n.apply($('#confirmModal'));show('#confirmModal');
    return new Promise(resolve=>{confirmResolver=resolve;setTimeout(()=>$('#confirmCancelBtn').focus(),60);});
  }
  function toast(msg){const element=document.createElement('div');element.className='toast';element.textContent=msg;I18n.apply(element);$('#toasts').append(element);setTimeout(()=>element.remove(),2800);}
  function post(data){ if(window.chrome?.webview) window.chrome.webview.postMessage(data); }
  function exportBackup(){post({type:'export',data:state,strings:{title:I18n.t('Salvar backup do SwapUp!'),backup:I18n.t('Backup SwapUp!'),json:I18n.t('Arquivo JSON')}});}
  function importBackup(){post({type:'import',strings:{title:I18n.t('Restaurar backup do SwapUp!'),backup:I18n.t('Backup SwapUp!')}});}
  function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
  function openBugReport(){hide('#settingsModal');$('#bugReportForm').reset();$('#bugSeverity').value='medium';bugAttachmentData='';bugAttachmentName='';$('#bugFile').classList.add('hidden');$('#bugDeliveryStatus').className='bug-delivery-status hidden';show('#bugReportModal');setTimeout(()=>$('#bugTitle').focus(),80);}
  function bugReportPayload(){return{id:uid(),createdAt:new Date().toISOString(),version:'1.3.2',type:$('#bugType').value,severity:$('#bugSeverity').value,title:$('#bugTitle').value.trim(),description:$('#bugDescription').value.trim(),steps:$('#bugSteps').value.trim(),contact:$('#bugContact').value.trim(),environment:{language:I18n.code,locale:I18n.locale,calendarSystem:state.settings.calendarSystem,view:currentView,theme:state.settings.theme,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,platform:navigator.userAgent},attachment:bugAttachmentData?{name:bugAttachmentName,data:bugAttachmentData}:null};}
  function bugReportText(report){return `[SwapUp! ${report.version}] ${report.title}\n\nType: ${report.type}\nSeverity: ${report.severity}\nLanguage: ${report.environment.language}\nCalendar: ${report.environment.calendarSystem}\nView: ${report.environment.view}\nTime zone: ${report.environment.timeZone}\nContact: ${report.contact||'-'}\n\nDescription:\n${report.description}\n\nSteps to reproduce:\n${report.steps||'-'}\n\nEnvironment:\n${report.environment.platform}\n\nReport ID: ${report.id}`;}
  function setBugStatus(message,success=false){const element=$('#bugDeliveryStatus');element.textContent=message;element.className=`bug-delivery-status${success?' success':''}`;I18n.apply(element);}

  let selectedAccent=state.settings.accent,autostartBefore=state.settings.autostart,pendingProfilePhoto=state.profile.photo||'',bugAttachmentData='',bugAttachmentName='',settingsDirty=false,settingsInitializing=false,settingsStatusTimer=0;
  function normalizeColor(value){const text=String(value||'').trim();const hex=text.match(/^#?([0-9a-f]{6})$/i);if(hex)return '#'+hex[1].toLowerCase();const short=text.match(/^#?([0-9a-f]{3})$/i);if(short)return '#'+[...short[1]].map(x=>x+x).join('').toLowerCase();const rgb=text.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);if(rgb){const values=rgb.slice(1).map(Number);if(values.every(x=>x>=0&&x<=255))return '#'+values.map(x=>x.toString(16).padStart(2,'0')).join('');}return null;}
  function switchSettingsTab(tab){$$('[data-settings-tab]').forEach(x=>x.classList.toggle('active',x.dataset.settingsTab===tab));$$('.settings-panel').forEach(x=>x.classList.toggle('active',x.dataset.panel===tab));}
  function setSettingsDirty(dirty){settingsDirty=dirty;$('#settingsSaveControls').classList.toggle('hidden',!dirty);$('.settings-actions').classList.toggle('clean',!dirty);if(dirty){clearTimeout(settingsStatusTimer);$('#settingsStatus').classList.add('hidden');}}
  function showSettingsSaved(){const status=$('#settingsStatus');clearTimeout(settingsStatusTimer);status.textContent=`✓ ${I18n.t('Alterações salvas')}`;status.classList.remove('hidden');settingsStatusTimer=setTimeout(()=>status.classList.add('hidden'),5000);}
  function markSettingsDirty(){if(!settingsInitializing)setSettingsDirty(true);}
  function renderAccents(){const palette=Object.keys(accentMap);$('#accentPicker').innerHTML=palette.map(c=>`<button type="button" class="accent-option ${c===selectedAccent?'selected':''}" data-accent="${c}" style="background:${c}" title="Escolher esta cor"></button>`).join('');$$('[data-accent]').forEach(x=>x.onclick=()=>{selectedAccent=x.dataset.accent;$('#customAccentColor').value=selectedAccent;$('#customAccentText').value=selectedAccent.toUpperCase();renderAccents();I18n.apply($('#accentPicker'));markSettingsDirty();});}
  function fillSettings(){
    $('#profileName').value=state.profile.name||'';$('#profileRole').value=state.profile.role||'';pendingProfilePhoto=state.profile.photo||'';setAvatarContent($('#profilePreview'),state.profile.name,pendingProfilePhoto);$('#removeProfilePhoto').classList.toggle('hidden',!pendingProfilePhoto);$('#settingLanguage').value=state.settings.language;
    $('#settingStartView').value=state.settings.startView;$('#settingAutostart').checked=!!state.settings.autostart;$('#settingConfirmDelete').checked=!!state.settings.confirmDelete;
    $('#settingTheme').value=state.settings.theme;$('#settingCompact').checked=!!state.settings.compact;$('#settingReduceMotion').checked=!!state.settings.reduceMotion;$('#settingFontScale').value=String(state.settings.fontScale);$('#settingHighContrast').checked=!!state.settings.highContrast;$('#settingReduceTransparency').checked=!!state.settings.reduceTransparency;$('#settingShowInsight').checked=state.settings.showInsight!==false;
    $('#settingCalendarSystem').value=state.settings.calendarSystem;$('#settingWeekStart').value=String(state.settings.weekStart);$('#settingTimeFormat').value=state.settings.timeFormat;$('#settingDuration').value=String(state.settings.duration);$('#settingDefaultReminder').value=String(state.settings.defaultReminder);$('#settingDefaultCategory').value=state.settings.defaultCategory;
    $('#settingNotifications').checked=!!state.settings.notifications;$('#settingNotifyLocation').checked=!!state.settings.notifyLocation;$('#statEvents').textContent=state.events.length;$('#statCategories').textContent=state.categories.length;const support=window.SWAPUP_PRODUCT_CONFIG||{},ready=!!(support.supportEmail||support.issueUrl);$('#supportChannelStatus').textContent=I18n.t(ready?'Canal de envio configurado e pronto para uso.':'Canal de envio ainda não configurado neste build. Os relatos ficam salvos localmente.');$('#supportChannelStatus').classList.toggle('ready',ready);
    $('#timezoneValue').textContent=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';selectedAccent=state.settings.accent;autostartBefore=state.settings.autostart;$('#customAccentColor').value=selectedAccent;$('#customAccentText').value=selectedAccent.toUpperCase();$('#customColorError').classList.add('hidden');renderAccents();
  }
  function openSettings(tab='general'){hide('#profileMenu');settingsInitializing=true;fillSettings();switchSettingsTab(tab);clearTimeout(settingsStatusTimer);$('#settingsStatus').classList.add('hidden');setSettingsDirty(false);show('#settingsModal');requestAnimationFrame(()=>settingsInitializing=false);}
  function saveSettings(){
    const profileName=$('#profileName').value.trim()||'Meu perfil';state.profile={name:profileName,role:$('#profileRole').value.trim(),photo:pendingProfilePhoto};
    state.settings={...state.settings,language:$('#settingLanguage').value,startView:$('#settingStartView').value,autostart:$('#settingAutostart').checked,confirmDelete:$('#settingConfirmDelete').checked,theme:$('#settingTheme').value,accent:selectedAccent,compact:$('#settingCompact').checked,reduceMotion:$('#settingReduceMotion').checked,fontScale:Number($('#settingFontScale').value),highContrast:$('#settingHighContrast').checked,reduceTransparency:$('#settingReduceTransparency').checked,showInsight:$('#settingShowInsight').checked,calendarSystem:$('#settingCalendarSystem').value,weekStart:Number($('#settingWeekStart').value),timeFormat:$('#settingTimeFormat').value,duration:Number($('#settingDuration').value),defaultReminder:Number($('#settingDefaultReminder').value),defaultCategory:$('#settingDefaultCategory').value,notifications:$('#settingNotifications').checked,notifyLocation:$('#settingNotifyLocation').checked};
    delete state.settings.dayStart;delete state.settings.dayEnd;
    if(autostartBefore!==state.settings.autostart)post({type:'setAutostart',enabled:state.settings.autostart});save();applyPreferences();render();autostartBefore=state.settings.autostart;setSettingsDirty(false);showSettingsSaved();toast('Configurações salvas.');
  }
  function switchView(view){currentView=view;$$('.view-switch button').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('#agendaShortcut').classList.toggle('active',view==='agenda');for(const name of ['month','week','day','agenda'])$(`#${name}View`).classList.toggle('hidden',view!==name);render();}

  $('#eventForm').onsubmit=e=>{e.preventDefault();const id=$('#eventId').value;const item={id:id||uid(),title:$('#eventTitle').value.trim(),date:$('#eventDate').value,allDay:$('#allDay').checked,startTime:$('#startTime').value||'00:00',endTime:$('#endTime').value||'23:59',location:$('#location').value.trim(),category:$('#category').value,reminder:Number($('#reminder').value),repeat:$('#repeat').value,notes:$('#notes').value.trim(),updatedAt:new Date().toISOString()}; if(!item.allDay&&item.endTime<item.startTime){toast('O horário final precisa ser após o início.');return;} const i=state.events.findIndex(x=>x.id===id);if(i>=0)state.events[i]=item;else state.events.push(item);save();selectedDate=item.date;cursor=parseDate(item.date);hide('#eventModal');render();toast(id?'Evento atualizado.':'Evento adicionado à sua agenda.');};
  $('#deleteBtn').onclick=async()=>{const id=$('#eventId').value;if(!id)return;const approved=!state.settings.confirmDelete||await askConfirmation('Excluir evento?',I18n.t('Excluir este evento da sua agenda?'),'Excluir evento');if(!approved)return;state.events=state.events.filter(e=>e.id!==id);save();hide('#eventModal');render();toast('Evento excluído.');};
  $('#allDay').onchange=setTimeFields;
  $$('[data-close]').forEach(x=>x.onclick=()=>hide('#eventModal'));
  $('#eventModal').onclick=e=>{if(e.target===$('#eventModal'))hide('#eventModal')};
  $('#newEventBtn').onclick=$('#quickAddBtn').onclick=()=>openNew(iso(new Date()));
  $('#todayBtn').onclick=()=>{cursor=new Date();cursor.setHours(12,0,0,0);agendaOffset=0;selectedDate=iso(new Date());render();};
  $('#prevBtn').onclick=()=>{if(currentView==='month')stepCalendarMonth(-1);else if(currentView==='week'){const d=parseDate(selectedDate);d.setDate(d.getDate()-7);selectedDate=iso(d);}else if(currentView==='day'){const d=parseDate(selectedDate);d.setDate(d.getDate()-1);selectedDate=iso(d);}else agendaOffset-=120;render();};
  $('#nextBtn').onclick=()=>{if(currentView==='month')stepCalendarMonth(1);else if(currentView==='week'){const d=parseDate(selectedDate);d.setDate(d.getDate()+7);selectedDate=iso(d);}else if(currentView==='day'){const d=parseDate(selectedDate);d.setDate(d.getDate()+1);selectedDate=iso(d);}else agendaOffset+=120;render();};
  $$('.view-switch button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $('#agendaShortcut').onclick=()=>switchView('agenda');
  $('#searchInput').oninput=e=>{query=e.target.value.trim().toLowerCase();render();};
  $('#mapBtn').onclick=()=>{const q=$('#location').value.trim();if(q)post({type:'openExternal',url:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`});else toast('Digite primeiro um endereço.');};
  $('#profileBtn').onclick=e=>{e.stopPropagation();$('#profileMenu').classList.toggle('hidden');};
  $$('[data-open-settings]').forEach(x=>x.onclick=()=>openSettings(x.dataset.openSettings));
  $$('[data-settings-tab]').forEach(x=>x.onclick=()=>switchSettingsTab(x.dataset.settingsTab));
  $$('[data-settings-close]').forEach(x=>x.onclick=()=>{setSettingsDirty(false);hide('#settingsModal');});
  $('#settingsModal').onclick=e=>{if(e.target===$('#settingsModal')){setSettingsDirty(false);hide('#settingsModal');}};
  $('#saveSettingsBtn').onclick=saveSettings;
  $('#settingsCancelBtn').onclick=()=>{setSettingsDirty(false);hide('#settingsModal');};
  $('#settingsModal').addEventListener('change',e=>{if(e.target.matches('input:not([type="file"]),select,textarea'))markSettingsDirty();});
  $('#settingsModal').addEventListener('input',e=>{if(e.target.matches('input:not([type="file"]):not(#customAccentColor):not(#customAccentText),textarea'))markSettingsDirty();});
  $('#profileName').oninput=e=>setAvatarContent($('#profilePreview'),e.target.value,pendingProfilePhoto);
  $('#chooseProfilePhoto').onclick=()=>$('#profilePhotoInput').click();
  $('#profilePhotoInput').onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8*1024*1024){toast('Escolha uma imagem PNG, JPG ou WebP de até 8 MB.');e.target.value='';return;}const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{const size=Math.min(image.width,image.height),sx=(image.width-size)/2,sy=(image.height-size)/2,canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;canvas.getContext('2d').drawImage(image,sx,sy,size,size,0,0,256,256);pendingProfilePhoto=canvas.toDataURL('image/jpeg',.88);setAvatarContent($('#profilePreview'),$('#profileName').value,pendingProfilePhoto);$('#removeProfilePhoto').classList.remove('hidden');markSettingsDirty();toast('Foto pronta. Salve as alterações para aplicar.');};image.src=String(reader.result);};reader.readAsDataURL(file);e.target.value='';};
  $('#removeProfilePhoto').onclick=()=>{pendingProfilePhoto='';setAvatarContent($('#profilePreview'),$('#profileName').value,'');$('#removeProfilePhoto').classList.add('hidden');markSettingsDirty();toast('Foto removida. Salve as alterações para aplicar.');};
  $('#customAccentColor').oninput=e=>{selectedAccent=e.target.value;$('#customAccentText').value=selectedAccent.toUpperCase();renderAccents();markSettingsDirty();};
  $('#customAccentText').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#applyCustomAccent').click();}};
  $('#applyCustomAccent').onclick=()=>{const color=normalizeColor($('#customAccentText').value||$('#customAccentColor').value);if(!color){$('#customColorError').classList.remove('hidden');toast('Cor inválida.');return;}selectedAccent=color;$('#customAccentColor').value=color;$('#customAccentText').value=color.toUpperCase();$('#customColorError').classList.add('hidden');renderAccents();markSettingsDirty();toast('Cor personalizada aplicada.');};
  $('#confirmCancelBtn').onclick=()=>closeConfirm(false);
  $('#confirmAcceptBtn').onclick=()=>closeConfirm(true);
  $('#confirmModal').onclick=e=>{if(e.target===$('#confirmModal'))closeConfirm(false);};
  $('#settingsBackupBtn').onclick=exportBackup;
  $('#settingsRestoreBtn').onclick=importBackup;
  $('#reportBugBtn').onclick=$('#settingsReportBugBtn').onclick=openBugReport;
  $$('[data-bug-close]').forEach(button=>button.onclick=()=>hide('#bugReportModal'));
  $('#bugReportModal').onclick=e=>{if(e.target===$('#bugReportModal'))hide('#bugReportModal');};
  $('#chooseBugAttachment').onclick=()=>$('#bugAttachmentInput').click();
  $('#bugAttachmentInput').onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>5*1024*1024){toast('A imagem deve ser PNG, JPG ou WebP e ter no máximo 5 MB.');e.target.value='';return;}const reader=new FileReader();reader.onload=()=>{bugAttachmentData=String(reader.result);bugAttachmentName=file.name;$('#bugImagePreview').src=bugAttachmentData;$('#bugFileName').textContent=file.name;$('#bugFile').classList.remove('hidden');};reader.readAsDataURL(file);e.target.value='';};
  $('#removeBugAttachment').onclick=()=>{bugAttachmentData='';bugAttachmentName='';$('#bugFile').classList.add('hidden');};
  $('#copyBugReportBtn').onclick=async()=>{const report=bugReportPayload();if(!report.title||!report.description){setBugStatus('Preencha o resumo e a descrição antes de copiar.');return;}try{await navigator.clipboard.writeText(bugReportText(report));toast('Relatório copiado.');}catch{setBugStatus('Não foi possível copiar automaticamente. Selecione e copie os campos manualmente.');}};
  $('#bugReportForm').onsubmit=e=>{e.preventDefault();const report=bugReportPayload(),config=window.SWAPUP_PRODUCT_CONFIG||{};setBugStatus('Preparando o relatório...');post({type:'bugReport',report,recipient:config.supportEmail||'',issueUrl:config.issueUrl||'',strings:{missing:I18n.t('O canal de suporte ainda não foi configurado pelo desenvolvedor.'),opened:I18n.t('Seu aplicativo de e-mail foi aberto. Revise e envie a mensagem.'),saved:I18n.t('O relatório foi salvo neste computador.')}});};
  document.addEventListener('click',e=>{if(!e.target.closest('.profile-control'))hide('#profileMenu')});

  $('#addCategoryBtn').onclick=()=>{chosenColor=colors[0];$('#categoryName').value='';renderColors();show('#categoryModal');setTimeout(()=>$('#categoryName').focus(),80);};
  function renderManageCalendars(){const list=$('#manageCalendarsList');list.innerHTML=state.categories.map(calendar=>{const count=state.events.filter(event=>event.category===calendar.id).length;return `<div class="manage-calendar-row"><i style="background:${calendar.color}"></i><div><b>${esc(calendar.name)}</b><small>${state.filters[calendar.id]===false?I18n.t('Oculto na agenda'):I18n.t('Visível na agenda')}</small></div><span class="calendar-count">${count} ${esc(I18n.t(count===1?'evento':'eventos'))}</span><button type="button" data-delete-calendar="${esc(calendar.id)}" ${state.categories.length===1?'disabled':''}>${esc(I18n.t('Excluir'))}</button></div>`}).join('');list.querySelectorAll('[data-delete-calendar]').forEach(button=>button.onclick=()=>deleteCalendar(button.dataset.deleteCalendar));I18n.apply(list);}
  function openManageCalendars(){renderManageCalendars();show('#manageCalendarsModal');}
  async function deleteCalendar(id){const calendar=state.categories.find(item=>item.id===id);if(!calendar||state.categories.length===1){toast('É necessário manter pelo menos um calendário.');return;}const count=state.events.filter(event=>event.category===id).length,fallback=state.categories.find(item=>item.id!==id);const message=count?`${count} ${I18n.t(count===1?'evento será movido':'eventos serão movidos')} ${I18n.t('para')} “${fallback.name}”. ${I18n.t('Esta ação não pode ser desfeita.')}`:I18n.t('Esta ação não pode ser desfeita.');const approved=await askConfirmation('Excluir calendário?',`${I18n.t('Excluir o calendário')} “${calendar.name}”? ${message}`,'Excluir calendário');if(!approved)return;state.events.forEach(event=>{if(event.category===id)event.category=fallback.id;});state.categories=state.categories.filter(item=>item.id!==id);delete state.filters[id];if(state.settings.defaultCategory===id)state.settings.defaultCategory=fallback.id;save();render();renderManageCalendars();toast('Calendário excluído e eventos preservados.');}
  $('#manageCalendarsBtn').onclick=openManageCalendars;
  $('#manageAddCalendarBtn').onclick=()=>{hide('#manageCalendarsModal');$('#addCategoryBtn').click();};
  $$('[data-manage-close]').forEach(button=>button.onclick=()=>hide('#manageCalendarsModal'));
  $('#manageCalendarsModal').onclick=e=>{if(e.target===$('#manageCalendarsModal'))hide('#manageCalendarsModal');};
  function renderColors(){$('#colorPicker').innerHTML=colors.map(c=>`<button type="button" class="color-option ${c===chosenColor?'selected':''}" style="background:${c}" data-color="${c}" title="Escolher cor"></button>`).join('');$$('[data-color]').forEach(b=>b.onclick=()=>{chosenColor=b.dataset.color;renderColors();});}
  $$('[data-category-close]').forEach(x=>x.onclick=()=>hide('#categoryModal'));
  $('#categoryForm').onsubmit=e=>{e.preventDefault();const name=$('#categoryName').value.trim();if(!name)return;state.categories.push({id:'cat-'+uid(),name,color:chosenColor});save();hide('#categoryModal');render();toast('Calendário criado.');};

  function checkReminders(){
    if(!state.settings.notifications)return;
    const now=new Date(), notified=JSON.parse(localStorage.getItem('swapup-notified')||'{}');
    for(let dayOffset=0;dayOffset<=1;dayOffset++){const d=new Date(now);d.setDate(now.getDate()+dayOffset);d.setHours(12,0,0,0);for(const e of state.events.filter(x=>occursOn(x,d))){if(Number(e.reminder)<0)continue;const at=new Date(d);if(e.allDay)at.setHours(9,0,0,0);else{const[h,m]=(e.startTime||'00:00').split(':').map(Number);at.setHours(h,m,0,0)}const alertAt=new Date(at.getTime()-Number(e.reminder)*60000),key=`${e.id}-${iso(d)}`;if(now>=alertAt&&now<at&& !notified[key]){notified[key]=Date.now();post({type:'notify',title:e.title,body:`${e.allDay?I18n.t('Hoje'):formatTime(e.startTime)}${state.settings.notifyLocation&&e.location?' · '+e.location:''}`});}}}
    const cutoff=Date.now()-2592000000;for(const k of Object.keys(notified))if(notified[k]<cutoff)delete notified[k];localStorage.setItem('swapup-notified',JSON.stringify(notified));
  }
  window.SwapUp={openNewEvent:()=>openNew(iso(new Date())),onBugReportResult:(status,message)=>setBugStatus(message,status==='opened'||status==='saved'),importData:(json)=>{try{const data=JSON.parse(json);if(!Array.isArray(data.events)||!Array.isArray(data.categories))throw 0;const importedSettings={...defaultSettings,...(data.settings||{})};if(data.version===1&&!data.settings)importedSettings.theme='light';state={...data,version:3,filters:data.filters||{},settings:importedSettings,profile:{...defaultProfile,...(data.profile||{})}};save();applyPreferences();switchView(state.settings.startView);toast('Backup restaurado com sucesso.');}catch{toast('Esse arquivo não é um backup válido do SwapUp!.');}}};
  document.onkeydown=e=>{
    const key=e.key.toLowerCase(),typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
    if(e.key==='Escape'){if(confirmResolver){e.preventDefault();closeConfirm(false);return;}setSettingsDirty(false);$$('.modal-backdrop,#profileMenu').forEach(x=>x.classList.add('hidden'));}
    if(e.ctrlKey&&key==='n'){e.preventDefault();openNew(iso(new Date()));}
    if(e.ctrlKey&&key==='f'){e.preventDefault();$('#searchInput').focus();}
    if(e.altKey&&key==='h'){e.preventDefault();$('#todayBtn').click();}
    if(e.ctrlKey&&e.key===','){e.preventDefault();openSettings('general');}
    if(!typing&&e.altKey&&e.key==='ArrowLeft'){e.preventDefault();$('#prevBtn').click();}
    if(!typing&&e.altKey&&e.key==='ArrowRight'){e.preventDefault();$('#nextBtn').click();}
    if(!typing&&e.ctrlKey&&!e.shiftKey&&['1','2','3','4'].includes(e.key)){e.preventDefault();switchView(({1:'month',2:'week',3:'day',4:'agenda'})[e.key]);}
    if(e.ctrlKey&&e.shiftKey&&key==='r'){e.preventDefault();openBugReport();}
  };
  applyPreferences();switchView(currentView);checkReminders();setInterval(checkReminders,30000);setInterval(()=>{renderInsight();I18n.apply($('#insightCard'));},60000);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(state.settings.theme==='system')applyPreferences();});
})();
