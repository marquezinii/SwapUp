(() => {
  'use strict';
  const packs=window.SWAPUP_TRANSLATIONS||{};
  const supported=['pt-BR','en','es','fr','de','it','nl','pl','ru','tr','ar','hi','zh-CN','ja','ko','id'];
  const localeMap={'pt-BR':'pt-BR',en:'en-US',es:'es-ES',fr:'fr-FR',de:'de-DE',it:'it-IT',nl:'nl-NL',pl:'pl-PL',ru:'ru-RU',tr:'tr-TR',ar:'ar-SA',hi:'hi-IN','zh-CN':'zh-CN',ja:'ja-JP',ko:'ko-KR',id:'id-ID'};
  const rtl=new Set(['ar']);
  const textOrigins=new WeakMap(),attributeOrigins=new WeakMap();
  let current='pt-BR';

  function resolve(requested){
    if(requested&&requested!=='system'&&supported.includes(requested))return requested;
    for(const candidate of navigator.languages||[navigator.language]){
      const normalized=candidate.toLowerCase();
      if(normalized.startsWith('zh'))return 'zh-CN';
      if(normalized.startsWith('pt'))return 'pt-BR';
      const match=supported.find(code=>normalized===code.toLowerCase()||normalized.startsWith(code.toLowerCase()+'-'));
      if(match)return match;
    }
    return 'en';
  }
  function t(source){return packs[current]?.[source]||packs['pt-BR']?.[source]||source;}
  function translateTextNode(node){
    if(node.parentElement?.closest('script,style,[data-no-i18n]'))return;
    const raw=textOrigins.get(node)??node.nodeValue;
    if(!textOrigins.has(node))textOrigins.set(node,raw);
    const match=raw.match(/^(\s*)(.*?)(\s*)$/s);if(!match||!match[2])return;
    node.nodeValue=match[1]+t(match[2])+match[3];
  }
  function translateAttributes(element){
    if(element.closest('[data-no-i18n]'))return;
    const attrs=attributeOrigins.get(element)||{};
    for(const name of ['placeholder','title','aria-label']){
      if(element.hasAttribute(name)&&attrs[name]===undefined)attrs[name]=element.getAttribute(name);
      if(attrs[name]!==undefined)element.setAttribute(name,t(attrs[name]));
    }
    attributeOrigins.set(element,attrs);
  }
  function apply(root=document){
    if(root.nodeType===Node.TEXT_NODE)translateTextNode(root);
    const scope=root.nodeType===Node.ELEMENT_NODE||root.nodeType===Node.DOCUMENT_NODE?root:document;
    const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode()))translateTextNode(node);
    if(scope.nodeType===Node.ELEMENT_NODE)translateAttributes(scope);
    scope.querySelectorAll?.('*').forEach(translateAttributes);
  }
  function setLanguage(requested){
    current=resolve(requested);document.documentElement.lang=localeMap[current];document.documentElement.dir=rtl.has(current)?'rtl':'ltr';apply(document);return current;
  }
  window.SwapUpI18n={supported,resolve,setLanguage,apply,t,get code(){return current},get locale(){return localeMap[current]}};
})();
