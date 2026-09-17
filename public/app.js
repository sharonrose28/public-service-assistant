import {content} from './content.js';
import {catalog,pick,extraText} from './catalog.js';
const $=id=>document.getElementById(id);
let selected='auto',currentLanguage='en',result=null,mode='local',busy=false;
const langNames={en:'English',ta:'தமிழ்',hi:'हिन्दी'};
function localize(lang){
 currentLanguage=lang;document.documentElement.lang=lang;const c=content[lang];
 $('hero-title').innerHTML=c.title;
 const fields={'eyebrow':'eyebrow','intro':'intro','ask-label':'ask','request-label':'ask','location-label':'location','submit':'submit','privacy':'privacy','try-label':'try','example-civic':'civicButton','example-service':'serviceButton','how-title':'how','trust-title':'trust','trust-desc':'trustDescription','coverage':'coverage','footer-note':'footer'};
 for(const [id,key] of Object.entries(fields))$(id).textContent=c[key];
 c.steps.forEach((s,i)=>{$(`step${i+1}`).textContent=s;$(`step${i+1}-desc`).textContent=c.stepDescriptions[i];});
 $('request').placeholder=c.placeholder;$('location').placeholder=c.locationPlaceholder;$('mode').textContent=c[mode==='bedrock'?'aiMode':'localMode'];
 $('coverage').textContent=pick(extraText.coverage,lang);
 let picker=$('catalog');if(!picker){picker=node('section');picker.id='catalog';$('mode').before(picker);}
 picker.replaceChildren();
 for(const kind of ['service','civic']){const group=node('div',undefined,'examples');group.append(node('span',kind==='service'?c.service:c.civic));for(const [id,entry] of Object.entries(catalog).filter(([,r])=>r.kind===kind)){const button=node('button',pick(entry.title,lang));button.type='button';button.dataset.category=id;button.onclick=()=>{$('request').value=pick(entry.title,lang);$('request').focus();};group.append(button);}picker.append(group);}
 document.querySelectorAll('[data-lang]').forEach(b=>{b.classList.toggle('selected',b.dataset.lang===selected);b.setAttribute('aria-pressed',String(b.dataset.lang===selected));});
}
function node(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function paragraph(parent,title,text){parent.append(node('h3',title),node('p',text));}
function list(parent,title,items,ordered=false){parent.append(node('h3',title));const ul=node(ordered?'ol':'ul');items.forEach(t=>ul.append(node('li',t)));parent.append(ul);}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function actionPanel(card,data,c){
 if(card.querySelector('.action-panel'))return;
 const panel=node('section',undefined,'action-panel');panel.tabIndex=-1;const isDraft=data.nextAction==='GENERATE_COMPLAINT';panel.append(node('h3',isDraft?c.draftTitle:c.checklistTitle));
 if(isDraft){panel.append(node('p',c.review));const draft=node('textarea',undefined,'draft');draft.value=data.draft;draft.setAttribute('aria-label',c.draftTitle);panel.append(draft);const save=node('button',c.download,'secondary');save.onclick=()=>download(draft.value,'complaint-draft.txt');panel.append(save);}
 else{const progress=node('p');const inputs=[];const update=()=>progress.textContent=`${inputs.filter(x=>x.checked).length} / ${inputs.length} ${c.progress}`;data.checklist.forEach(text=>{const label=node('label',undefined,'check-row');const checkbox=node('input');checkbox.type='checkbox';checkbox.onchange=update;inputs.push(checkbox);label.append(checkbox,node('span',text));panel.append(label);});progress.setAttribute('aria-live','polite');panel.append(progress);update();const save=node('button',c.checklistDownload,'secondary');save.onclick=()=>download(`${data.title}\n\n${data.checklist.map((t,i)=>`[${inputs[i].checked?'x':' '}] ${t}`).join('\n')}\n\n${c.source}: ${data.source.url}\n${c.verified}: ${data.source.verified}\n\n${data.notice}`,'application-checklist.txt');panel.append(save);}
 card.append(panel);panel.focus();
}
function render(data){
 const c=content[data.language],root=$('result');root.replaceChildren();root.hidden=false;
 const card=node('article',undefined,'card result-card'),top=node('div',undefined,'result-top');top.append(node('span',data.intent==='CIVIC_ISSUE'?c.civic:data.intent==='GOVERNMENT_SERVICE'?c.service:c.unknown,'badge'),node('small',langNames[data.language]));card.append(top,node('h2',data.title),node('p',data.summary));
 if(data.warning)card.append(node('p',c.fallback,'notice'));
 if(data.intent!=='UNKNOWN'){
  const entities=node('div',undefined,'entities');for(const [key,label] of [['location',c.place],...(data.intent==='CIVIC_ISSUE'?[['duration',c.duration]]:[])])entities.append(node('span',`${label}: ${data.entities[key]||c.missing}`,'entity'));card.append(entities);
  paragraph(card,c.department,data.department);
  if(data.eligibility)paragraph(card,c.eligibility,data.eligibility);
  card.append(node('p',data.notice,'notice'));
  if(data.documents)list(card,c.documents,data.documents);
  list(card,data.intent==='CIVIC_ISSUE'?`${c.plan} · ${c.suggested}`:c.process,data.steps,true);
  const source=node('div',undefined,'source');source.append(node('h3',c.source));const link=node('a',`${data.source.label} ↗`);link.href=data.source.url;link.target='_blank';link.rel='noopener noreferrer';source.append(link,node('small',`${c.verified}: ${data.source.verified}`));
  if(data.source.portal){const portal=node('a',c.portal);portal.href=data.source.portal;portal.target='_blank';portal.rel='noopener noreferrer';const row=node('p');row.append(portal);source.append(row);}
  card.append(source);const next=node('div',undefined,'next'),button=node('button',data.nextAction==='GENERATE_COMPLAINT'?c.generate:c.checklist,'primary');button.onclick=()=>actionPanel(card,data,c);next.append(node('strong',c.next),button);card.append(next);
 }
 root.append(card);root.focus();
}
async function submit(){
 if(busy||!$('ask-form').reportValidity())return;
 busy=true;$('submit').disabled=true;document.querySelectorAll('[data-lang],.examples button').forEach(b=>b.disabled=true);$('result').hidden=true;$('status').textContent=content[currentLanguage].loading;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),23000);
 try{const response=await fetch('/api/assist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:$('request').value,location:$('location').value,language:selected}),signal:controller.signal});if(!response.ok)throw new Error();result=await response.json();localize(result.language);render(result);$('status').textContent='';}catch{$('status').textContent=content[currentLanguage].error;}finally{clearTimeout(timer);busy=false;$('submit').disabled=false;document.querySelectorAll('[data-lang],.examples button').forEach(b=>b.disabled=false);}
}
$('ask-form').onsubmit=e=>{e.preventDefault();submit();};
document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{selected=b.dataset.lang;localize(selected==='auto'?(result?.detectedLanguage||'en'):selected);if(result)submit();});
$('example-civic').onclick=()=>{$('request').value=content[currentLanguage].civicExample;$('request').focus();};
$('example-service').onclick=()=>{$('request').value=content[currentLanguage].serviceExample;$('request').focus();};
try{const response=await fetch('/api/health');if(response.ok)mode=(await response.json()).mode;}catch{}
localize('en');
