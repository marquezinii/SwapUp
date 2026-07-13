const fs=require('fs');
const assert=require('assert');
const locales=['pt-BR','en-US','es-ES','fr-FR','de-DE','it-IT','nl-NL','pl-PL','ru-RU','tr-TR','ar-SA','hi-IN','zh-CN','ja-JP','ko-KR','id-ID'];
const systems=['gregory','buddhist','islamic','hebrew','persian','indian','japanese','chinese'];
const supported=new Set(Intl.supportedValuesOf('calendar'));
for(const system of systems)assert(supported.has(system),`Calendário ${system} não suportado pelo runtime`);

function parts(date,system){const result={};for(const part of new Intl.DateTimeFormat(`en-u-ca-${system}-nu-latn`,{year:'numeric',month:'numeric',day:'numeric',era:'short'}).formatToParts(date)){if(['year','relatedYear','month','day','era'].includes(part.type))result[part.type]=part.value;}return result;}
function monthId(date,system){const value=parts(date,system);return `${value.era||''}|${value.relatedYear||value.year||''}|${value.month||''}`;}
function monthFirst(base,system){const date=new Date(base);date.setHours(12,0,0,0);for(let i=0;i<40;i++){if(Number(parts(date,system).day)===1)return date;date.setDate(date.getDate()-1);}throw new Error(`Dia 1 não encontrado: ${system}`);}

let checks=0;
for(const locale of locales){
  for(const system of systems){
    const date=new Date(2026,6,12,12);
    const calendarLocale=`${locale}-u-ca-${system}`;
    const month=new Intl.DateTimeFormat(calendarLocale,{month:'long',year:'numeric'}).format(date);
    const day=new Intl.DateTimeFormat(calendarLocale,{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);
    assert(month.length>0&&day.length>0,`${locale}/${system}: formatação vazia`);
    const first=monthFirst(date,system),id=monthId(first,system),cells=[];
    const start=new Date(first),offset=first.getDay();start.setDate(first.getDate()-offset);
    for(let i=0;i<42;i++){const item=new Date(start);item.setDate(start.getDate()+i);cells.push(item);}
    assert(cells.some(item=>monthId(item,system)===id),`${locale}/${system}: mês não aparece na grade`);
    let next=new Date(first);for(let i=0;i<42&&monthId(next,system)===id;i++)next.setDate(next.getDate()+1);
    assert(monthId(next,system)!==id,`${locale}/${system}: navegação não avançou`);
    checks++;
  }
}

const html=fs.readFileSync('web/index.html','utf8');
for(const system of systems)assert(html.includes(`value="${system}"`),`Opção ${system} ausente na interface`);
for(const view of ['month','week','day'])assert(html.includes(`data-view="${view}"`),`Visão ${view} ausente`);
assert(html.includes('id="agendaShortcut"')&&html.includes('id="agendaView"'),`Visão agenda ausente`);
console.log(`OK: ${checks} combinações de idioma/calendário e 4 visualizações verificadas.`);
