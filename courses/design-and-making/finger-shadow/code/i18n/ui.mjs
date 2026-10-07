// SPDX-License-Identifier: MIT
// Localise presentation while retaining gesture IDs, practice scripts and student work.
const languages=['zh-CN','en','ru','fr','es','ar','ja','de','ko','hi','bn','pt','ur','fi','da','nl'];
const languageLabels={'zh-CN':'语言',en:'Language',ru:'Язык',fr:'Langue',es:'Idioma',ar:'اللغة',ja:'言語',de:'Sprache',ko:'언어',hi:'भाषा',bn:'ভাষা',pt:'Idioma',ur:'زبان',fi:'Kieli',da:'Sprog',nl:'Taal'};
const url=new URL(location.href);
const pathLanguage=location.pathname.split('/').find((part)=>languages.includes(part));
let preference;
try{preference=sessionStorage.getItem('ahalab-shadow-language');}catch{}
const requested=url.searchParams.get('lang')||pathLanguage||preference||'zh-CN';
const locale=languages.includes(requested)?requested:'zh-CN';
document.documentElement.lang=locale;
document.documentElement.dir=['ar','ur'].includes(locale)?'rtl':'ltr';
try{sessionStorage.setItem('ahalab-shadow-language',locale);}catch{}
let messages={},keys=[],pattern=null;
const normalize=(value)=>value.replace(/\s+/g,' ').trim();
const han=/[\u3400-\u9fff]/u;
if(locale!=='zh-CN'){
  const response=await fetch(new URL(`${locale}.json`,import.meta.url));
  if(!response.ok)throw new Error(`Language catalogue unavailable: ${locale}`);
  messages=await response.json();
  keys=Object.keys(messages).filter(key=>han.test(key)&&key.length>0).sort((a,b)=>b.length-a.length);
  pattern=new RegExp(keys.map(key=>key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');
}
function translate(value){
  if(typeof value!=='string'||locale==='zh-CN'||!han.test(value))return value;
  const key=normalize(value);
  if(messages[key])return value.slice(0,value.length-value.trimStart().length)+messages[key]+value.slice(value.trimEnd().length);
  return pattern?value.replace(pattern,(part,offset,whole)=>{
    let result=messages[part]||part;
    // Keep short dynamically concatenated labels readable in Latin-script UIs.
    if(['en','fr','es','de','pt','fi','da','nl'].includes(locale)&&/[A-Za-z]$/.test(result)&&/[\u3400-\u9fff0-9]/u.test(whole[offset+part.length]||''))result+=' ';
    return result;
  }):value;
}
window.__shadowTranslate=translate;
window.__shadowLocale=locale;
const protectedSelector='script,style,code,pre,textarea,[contenteditable=true],[data-i18n-preserve],.print-value,#chinese-before,#chinese-line,#chinese-after,#library option:not([value=""]),.shadow-language';
const previous=new WeakMap();
function textNode(node){
  if(!node.parentElement||node.parentElement.closest(protectedSelector))return;
  const value=node.nodeValue;
  if(previous.get(node)===value)return;
  const next=translate(value);
  if(value!==next){node.nodeValue=next;previous.set(node,next);}
}
function linkLanguage(element){
  if(element.matches('a[href]')){
    const target=new URL(element.getAttribute('href'),document.baseURI);
    if(target.origin===location.origin&&/\.html$|\/course\/finger-shadow\/$/.test(target.pathname)&&!target.hash){
      target.searchParams.set('lang',locale);element.setAttribute('href',target.href);
    }
  }
  if(element.matches('iframe[src]')&&element.getAttribute('src')!=='about:blank'){
    const target=new URL(element.getAttribute('src'),document.baseURI);
    if(target.origin===location.origin&&target.pathname.endsWith('/app/index.html')){target.searchParams.set('lang',locale);if(element.src!==target.href)element.src=target.href;}
  }
}
function elementNode(element){
  if(element.matches?.(protectedSelector)||element.closest?.('[data-i18n-preserve]'))return;
  for(const attribute of ['alt','title','aria-label','placeholder']){
    const value=element.getAttribute?.(attribute);
    if(value&&han.test(value)){const next=translate(value);if(next!==value)element.setAttribute(attribute,next);}
  }
  linkLanguage(element);
}
function update(root){
  if(root.nodeType===Node.TEXT_NODE){textNode(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE)return;
  if(root.nodeType===Node.ELEMENT_NODE){elementNode(root);if(root.closest(protectedSelector))return;}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode())textNode(walker.currentNode);
  root.querySelectorAll?.('[alt],[title],[aria-label],[placeholder],a[href],iframe[src]').forEach(elementNode);
}
const observer=new MutationObserver(records=>{
  observer.disconnect();
  for(const record of records){
    if(record.type==='childList')record.addedNodes.forEach(update);
    else if(record.type==='characterData')textNode(record.target);
    else elementNode(record.target);
  }
  observe();
});
function observe(){observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['alt','title','aria-label','placeholder','href','src']});}
function start(){
  document.querySelectorAll('textarea,input[type=text],input[type=search]').forEach(input=>input.setAttribute('dir','auto'));
  document.querySelectorAll('[data-shadow-language]').forEach(select=>{
    select.value=locale;
    select.setAttribute('aria-label',languageLabels[locale]);
    const label=select.closest('.shadow-language');
    if(label?.firstChild?.nodeType===Node.TEXT_NODE)label.firstChild.nodeValue=languageLabels[locale]+' ';
    select.addEventListener('change',()=>{
      const chosen=select.value,target=new URL(location.href);
      target.searchParams.set('lang',chosen);
      // Dedicated website routes remain shareable; local source uses the query.
      if(pathLanguage)target.pathname=target.pathname.replace(`/${pathLanguage}/`,`/${chosen==='zh-CN'?'':chosen+'/'}`);
      try{sessionStorage.setItem('ahalab-shadow-language',chosen);}catch{}
      location.assign(target);
    });
  });
  update(document.documentElement);observe();
  document.dispatchEvent(new CustomEvent('shadow-language-ready',{detail:{locale}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
