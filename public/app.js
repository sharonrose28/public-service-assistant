import {content} from './content.js';
import {catalog,groups,pick,extraText} from './catalog.js';
const $=id=>document.getElementById(id);
let selected='auto',currentLanguage='en',result=null,mode='local',busy=false;
let subjectChoice,stateId,choiceRequest='',stateRequestKey='';
const langNames={en:'English',ta:'தமிழ்',hi:'हिन्दी'};
function localize(lang){
 currentLanguage=lang;document.documentElement.lang=lang;const c=content[lang];
 $('hero-title').innerHTML=c.title;
 const fields={'eyebrow':'eyebrow','intro':'intro','ask-label':'ask','request-label':'ask','submit':'submit','privacy':'privacy','try-label':'try','how-title':'how','trust-title':'trust','trust-desc':'trustDescription','coverage':'coverage','footer-note':'footer'};
 for(const [id,key] of Object.entries(fields))$(id).textContent=c[key];
 c.steps.forEach((s,i)=>{$(`step${i+1}`).textContent=s;$(`step${i+1}-desc`).textContent=c.stepDescriptions[i];});
 $('request').placeholder=c.placeholder;$('mode').textContent=c[mode==='bedrock'?'aiMode':mode==='strands'?'strandsMode':'localMode'];
 $('coverage').textContent=pick(extraText.coverage,lang);
 $('try-label').textContent=pick(['CHOOSE A SERVICE OR COMPLAINT','சேவை அல்லது புகாரைத் தேர்ந்தெடுக்கவும்','सेवा या शिकायत चुनें'],lang);
 $('intro').textContent=pick(['Choose a service or describe your issue. Find the available official links, email contacts and a message you can edit.','சேவையைத் தேர்ந்தெடுக்கவும் அல்லது பிரச்சினையைச் சொல்லவும். அதிகாரப்பூர்வ இணைப்புகள், மின்னஞ்சல் தொடர்புகள் மற்றும் திருத்தக்கூடிய செய்தியைப் பெறுங்கள்.','सेवा चुनें या अपनी समस्या बताएँ। उपलब्ध आधिकारिक लिंक, ईमेल संपर्क और संपादन योग्य संदेश पाएँ।'],lang);
 $('step1').textContent=pick(['Choose what you need','உங்கள் தேவையைத் தேர்ந்தெடுக்கவும்','अपनी जरूरत चुनें'],lang);
 $('step2').textContent=pick(['Find the right official channel','சரியான அதிகாரப்பூர்வ வழியைக் கண்டறியவும்','सही आधिकारिक माध्यम पाएँ'],lang);
 $('step2-desc').textContent=pick(['Use common links directly. Choose a state for regional links and contacts.','பொதுவான இணைப்புகளை நேரடியாகப் பயன்படுத்தவும். மாநில இணைப்புகள் மற்றும் தொடர்புகளுக்கு மாநிலத்தைத் தேர்ந்தெடுக்கவும்.','साझा लिंक सीधे खोलें। क्षेत्रीय लिंक और संपर्कों के लिए राज्य चुनें।'],lang);
 $('step3-desc').textContent=pick(['Edit a message, copy it or open an email draft.','செய்தியைத் திருத்தி, நகலெடுக்கவும் அல்லது மின்னஞ்சல் வரைவைத் திறக்கவும்.','संदेश संपादित करें, कॉपी करें या ईमेल मसौदा खोलें।'],lang);
 let picker=$('catalog');if(!picker){picker=node('section');picker.id='catalog';$('mode').before(picker);}
 picker.replaceChildren();
 for(const kind of ['service','civic']){const section=node('section',undefined,'category-section');section.append(node('h2',kind==='service'?c.service:c.civic));for(const [groupId,label] of Object.entries(groups)){const entries=Object.entries(catalog).filter(([,r])=>r.kind===kind&&r.group===groupId);if(!entries.length)continue;const group=node('div',undefined,'category-group');group.append(node('h3',pick(label,lang)));const buttons=node('div',undefined,'examples');for(const [id,entry] of entries){const button=node('button',pick(entry.title,lang));button.type='button';button.dataset.category=id;button.onclick=()=>{$('request').value=pick(entry.title,lang);subjectChoice=id;choiceRequest=$('request').value;submit();};buttons.append(button);}group.append(buttons);section.append(group);}picker.append(section);}
 document.querySelectorAll('[data-lang]').forEach(b=>{b.classList.toggle('selected',b.dataset.lang===selected);b.setAttribute('aria-pressed',String(b.dataset.lang===selected));});
}
function node(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function paragraph(parent,title,text){parent.append(node('h3',title),node('p',text));}
function list(parent,title,items,ordered=false){parent.append(node('h3',title));const ul=node(ordered?'ol':'ul');items.forEach(t=>ul.append(node('li',t)));parent.append(ul);}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const say=(lang,en,ta,hi)=>pick([en,ta,hi],lang);
function externalLink(label,url){const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function emailUrl(address,subject,body){
 const query=[];
 if(subject)query.push(`subject=${encodeURIComponent(subject)}`);
 if(body)query.push(`body=${encodeURIComponent(body.replace(/\r\n|\r|\n/g,'\r\n'))}`);
 return `mailto:${encodeURIComponent(address).replace(/%40/g,'@')}${query.length?'?'+query.join('&'):''}`;
}
function actionPanel(card,data,c){
 const existing=card.querySelector('.action-panel');if(existing){existing.querySelector('textarea').focus();return;}
 const lang=data.language,panel=node('section',undefined,'action-panel');panel.tabIndex=-1;
 const title=say(lang,'Your message draft','உங்கள் செய்தி வரைவு','आपके संदेश का मसौदा');
 panel.append(node('h3',title),node('p',say(lang,'Review and edit before sending. Nothing is sent by this application.','அனுப்பும் முன் சரிபார்த்துத் திருத்தவும். இந்தச் செயலி எதையும் அனுப்பாது.','भेजने से पहले जाँचें और संपादित करें। यह ऐप कुछ भी नहीं भेजता।')));
 const draft=node('textarea',undefined,'draft');draft.value=data.draft;draft.setAttribute('aria-label',title);panel.append(draft);
 const controls=node('div',undefined,'draft-controls');
 const edit=node('button',say(lang,'Edit','திருத்து','संपादित करें'),'secondary');edit.onclick=()=>draft.focus();
 const copy=node('button',say(lang,'Copy','நகலெடு','कॉपी करें'),'secondary');
 const feedback=node('p');feedback.setAttribute('role','status');
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(draft.value);feedback.textContent=say(lang,'Copied','நகலெடுக்கப்பட்டது','कॉपी किया गया');}catch{draft.focus();draft.select();feedback.textContent=say(lang,'Select and copy the draft using your keyboard.','விசைப்பலகை மூலம் வரைவை நகலெடுக்கவும்.','कीबोर्ड से मसौदे को चुनें और कॉपी करें।');}};
 const save=node('button',say(lang,'Download','பதிவிறக்கு','डाउनलोड'),'secondary');save.onclick=()=>download(draft.value,'message-draft.txt');controls.append(edit,copy,save);panel.append(controls,feedback);
 const contacts=[...(data.officialOptions||[]),...(data.followUpOptions||[])].filter((o,i,all)=>o.contactEmail?.draftAllowed&&all.findIndex(x=>x.contactEmail?.address===o.contactEmail.address)===i);
 if(contacts.length){
  const review=node('label',undefined,'review-row'),check=node('input');check.type='checkbox';review.append(check,node('span',say(lang,'I reviewed the message, recipient and service coverage.','செய்தி, பெறுநர் மற்றும் சேவைப் பகுதியைச் சரிபார்த்தேன்.','मैंने संदेश, प्राप्तकर्ता और सेवा क्षेत्र की समीक्षा की है।')));panel.append(review);
  const emails=[];
  for(const option of contacts){panel.append(node('p',`${option.department}: ${option.contactEmail.purpose}`,'contact-purpose'));const a=node('a',`${say(lang,'Open in email app','மின்னஞ்சல் செயலியில் திறக்க','ईमेल ऐप में खोलें')} · ${option.contactEmail.address}`,'email-draft secondary');a.setAttribute('aria-disabled','true');a.tabIndex=-1;emails.push([a,option.contactEmail.address]);panel.append(a);}
  panel.append(node('small',say(lang,'Opens your device’s default email app. If nothing opens, set up an email app or copy the message and address.','உங்கள் சாதனத்தின் இயல்புநிலை மின்னஞ்சல் செயலியைத் திறக்கும். திறக்கவில்லை என்றால் மின்னஞ்சல் செயலியை அமைக்கவும் அல்லது செய்தியையும் முகவரியையும் நகலெடுக்கவும்.','आपके डिवाइस का डिफ़ॉल्ट ईमेल ऐप खुलेगा। कुछ न खुले तो ईमेल ऐप सेट करें या संदेश और पता कॉपी करें।')));
  const update=()=>{for(const [a,address] of emails){a.setAttribute('aria-disabled',String(!check.checked));a.tabIndex=check.checked?0:-1;if(check.checked)a.href=emailUrl(address,data.title,draft.value);else a.removeAttribute('href');}};
  check.onchange=update;draft.oninput=()=>{check.checked=false;update();};update();
 }
 card.append(panel);panel.focus();
}
function renderChannel(option,data){
 const lang=data.language,c=content[lang],channel=node('section',undefined,'service-channel');
 channel.append(node('h3',option.department),node('p',`${say(lang,'Coverage','சேவைப் பகுதி','सेवा क्षेत्र')}: ${option.coverage}`,'channel-coverage'));
 if(option.description)channel.append(node('p',option.description));
 if(option.steps?.length)list(channel,say(lang,'How to proceed','செயல்முறை','आगे कैसे बढ़ें'),option.steps,true);
 if(option.eligibility)paragraph(channel,say(lang,'Who can apply','விண்ணப்பத் தகுதி','कौन आवेदन कर सकता है'),Array.isArray(option.eligibility)?option.eligibility.join(' '):option.eligibility);
 if(option.documents?.length)list(channel,say(lang,'Published document guidance','வெளியிடப்பட்ட ஆவண வழிகாட்டல்','प्रकाशित दस्तावेज़ मार्गदर्शन'),option.documents);
 if(option.requiredDetails?.length)list(channel,say(lang,'Details for this channel','இந்த வழிக்கான விவரங்கள்','इस माध्यम के लिए विवरण'),option.requiredDetails);
 if(option.fees)paragraph(channel,say(lang,'Published fees','வெளியிடப்பட்ட கட்டணம்','प्रकाशित शुल्क'),option.fees);
 if(option.processingTime)paragraph(channel,say(lang,'Published timing','வெளியிடப்பட்ட கால அளவு','प्रकाशित समय'),option.processingTime);
 if(option.offlineOption)paragraph(channel,say(lang,'Offline option','நேரடி விண்ணப்ப வழி','ऑफलाइन विकल्प'),option.offlineOption);
 if(option.escalation)paragraph(channel,say(lang,'Follow-up','தொடர் விசாரணை','आगे पूछताछ'),option.escalation);
 for(const condition of option.conditions||[])channel.append(node('p',condition,'channel-condition'));
 const links=node('div',undefined,'channel-links');
 const label=option.linkType==='directory'?say(lang,'Open official directory ↗','அதிகாரப்பூர்வ பட்டியலைத் திறக்க ↗','आधिकारिक निर्देशिका खोलें ↗'):option.linkType==='guidance'?say(lang,'Open official guidance ↗','அதிகாரப்பூர்வ வழிகாட்டலைத் திறக்க ↗','आधिकारिक मार्गदर्शन खोलें ↗'):option.linkType==='app'?say(lang,'Open official app ↗','அதிகாரப்பூர்வ செயலியைத் திறக்க ↗','आधिकारिक ऐप खोलें ↗'):option.role==='grievance'||data.intent==='CIVIC_ISSUE'?say(lang,'Open complaint portal ↗','புகார் தளத்தைத் திறக்க ↗','शिकायत पोर्टल खोलें ↗'):say(lang,'Open official portal ↗','அதிகாரப்பூர்வ தளத்தைத் திறக்க ↗','आधिकारिक पोर्टल खोलें ↗');
 links.append(externalLink(label,option.officialPortal));channel.append(links);
 if(option.contactPhone){const phone=option.contactPhone,a=node('a',phone.number,'phone-link');a.href=`tel:${phone.number.replace(/[^+\d]/g,'')}`;const p=node('p',say(lang,'Phone: ','தொலைபேசி: ','फ़ोन: '));p.append(a);channel.append(p,node('p',phone.purpose,'contact-purpose'));}
 if(option.contactEmail){
  const email=option.contactEmail,address=node('p',`${say(lang,'Email','மின்னஞ்சல்','ईमेल')}: `,'contact-address'),link=node('a',email.address);
  link.href=emailUrl(email.address,data.title);
  link.title=say(lang,'Open in your device’s email app','உங்கள் சாதனத்தின் மின்னஞ்சல் செயலியில் திறக்க','अपने डिवाइस के ईमेल ऐप में खोलें');
  link.setAttribute('aria-label',`${link.title}: ${email.address}`);
  address.append(link);channel.append(address,node('p',email.purpose,'contact-purpose'));
 }
 const sources=node('details',undefined,'source-details');sources.append(node('summary',`${say(lang,'Official sources','அதிகாரப்பூர்வ ஆதாரங்கள்','आधिकारिक स्रोत')} · ${c.verified}: ${option.lastVerifiedAt}`));
 const urls=[...new Set([...(option.sourceUrls||[]),option.contactPhone?.sourceUrl,option.contactEmail?.sourceUrl].filter(Boolean))];
 for(const [i,url] of urls.entries())sources.append(externalLink(`${say(lang,'Source','ஆதாரம்','स्रोत')} ${i+1} · ${new URL(url).hostname} ↗`,url));
 channel.append(sources);return channel;
}
function render(data){
 const lang=data.language,c=content[lang],root=$('result');root.replaceChildren();root.hidden=false;
 const card=node('article',undefined,'card result-card'),top=node('div',undefined,'result-top');
 top.append(node('span',data.intent==='CIVIC_ISSUE'?c.civic:data.intent==='GOVERNMENT_SERVICE'?c.service:c.unknown,'badge'),node('small',langNames[lang]));card.append(top,node('h2',data.title),node('p',data.summary));
 if(data.languageNotice)card.append(node('p',data.languageNotice,'notice'));
 if(data.warning)card.append(node('p',c.fallback,'notice'));
 const categories=node('div',undefined,'examples');
 for(const choice of data.clarificationChoices||data.categoryChoices||[]){const button=node('button',choice.title);button.type='button';button.onclick=()=>{subjectChoice=choice.id;choiceRequest=$('request').value;submit();};categories.append(button);}
 if(data.needsClarification){card.append(categories);root.append(card);root.focus();return;}
 const correction=node('details');correction.append(node('summary',say(lang,'Change category','வகையை மாற்று','श्रेणी बदलें')),categories);card.append(correction);
 let optionalStatePicker;
 if(data.canChooseState){
  const field=node('div',undefined,'state-field'),label=node('label',say(lang,'State or union territory','மாநிலம் அல்லது யூனியன் பிரதேசம்','राज्य या केंद्र शासित प्रदेश'));label.htmlFor='state-select';
  const select=node('select');select.id='state-select';select.setAttribute('aria-describedby','state-help');
  const placeholder=node('option',say(lang,'Choose your state','உங்கள் மாநிலத்தைத் தேர்ந்தெடுக்கவும்','अपना राज्य चुनें'));placeholder.value='';select.append(placeholder);
  for(const state of data.stateOptions){const option=node('option',state.name);option.value=state.id;select.append(option);}select.value=data.stateId||'';
  select.onchange=()=>{stateId=select.value||undefined;submit();};
  const help=node('small',data.requiresState?say(lang,'The available portal or contact varies by state. City-specific coverage is shown on each result.','தளம் அல்லது தொடர்பு மாநிலத்திற்கு மாறுபடும். நகர சேவைப் பகுதி முடிவில் காட்டப்படும்.','पोर्टल या संपर्क राज्य के अनुसार बदलता है। हर परिणाम में शहर का सेवा क्षेत्र दिया गया है।'):say(lang,'Optional: choose a state for additional local links and contacts. You can use the common official link without this choice.','விருப்பத் தேர்வு: கூடுதல் மாநில இணைப்புகள் மற்றும் தொடர்புகளுக்கு மாநிலத்தைத் தேர்ந்தெடுக்கவும். இதைத் தேர்வு செய்யாமல் பொதுவான அதிகாரப்பூர்வ இணைப்பைப் பயன்படுத்தலாம்.','वैकल्पिक: अतिरिक्त स्थानीय लिंक और संपर्कों के लिए राज्य चुनें। साझा आधिकारिक लिंक के लिए यह चुनाव जरूरी नहीं है।'));help.id='state-help';field.append(label,select,help);
  if(data.requiresState)card.append(field);
  else{optionalStatePicker=node('details',undefined,'optional-state');optionalStatePicker.open=Boolean(data.stateId);optionalStatePicker.append(node('summary',say(lang,'View state-specific links and contacts (optional)','மாநில இணைப்புகள் மற்றும் தொடர்புகளைக் காண்க (விருப்பத் தேர்வு)','राज्य के खास लिंक और संपर्क देखें (वैकल्पिक)')),field);}
 }
 if(data.entities?.duration)paragraph(card,say(lang,'Reported duration','தெரிவித்த கால அளவு','बताई गई अवधि'),data.entities.duration);
 card.append(node('p',data.notice,'coverage-note'));
 if(data.officialOptions?.length)card.append(node('h3',say(lang,'Official services and contacts','அதிகாரப்பூர்வ சேவைகள் மற்றும் தொடர்புகள்','आधिकारिक सेवाएँ और संपर्क')));
 for(const option of data.officialOptions||[])card.append(renderChannel(option,data));
 if(!data.hasDirectChannel&&!data.hasCommonGateway&&!data.needsState)card.append(node('p',data.stateId?say(lang,'We do not yet have a verified submission portal covering this entire state for this request. Any listed city, operator or specialist channel applies only to its stated coverage. You can use the official directory or prepare a message.','இந்தக் கோரிக்கைக்கு மாநிலம் முழுவதற்குமான சரிபார்க்கப்பட்ட சமர்ப்பிப்பு தளம் இன்னும் இல்லை. நகரம் அல்லது நிறுவன வழிகள் குறிப்பிடப்பட்ட பகுதிக்கு மட்டுமே பொருந்தும். அதிகாரப்பூர்வ பட்டியலைப் பயன்படுத்தலாம் அல்லது செய்தி உருவாக்கலாம்.','इस अनुरोध के लिए पूरे राज्य को कवर करने वाला सत्यापित आवेदन पोर्टल अभी उपलब्ध नहीं है। सूचीबद्ध शहर, संचालक या विशेष सेवा का माध्यम केवल बताए क्षेत्र में लागू है। निर्देशिका देखें या संदेश तैयार करें।'):say(lang,'No current verified direct channel is available for this request. You can use the official directory or prepare a message.','இந்தக் கோரிக்கைக்கு தற்போதைய சரிபார்க்கப்பட்ட நேரடி வழி இல்லை. அதிகாரப்பூர்வ பட்டியலைப் பயன்படுத்தலாம் அல்லது செய்தி உருவாக்கலாம்.','इस अनुरोध के लिए वर्तमान सत्यापित सीधा माध्यम उपलब्ध नहीं है। आधिकारिक निर्देशिका देखें या संदेश तैयार करें।'),'notice'));
 if(data.directory&&!data.needsState&&!data.officialOptions?.some(o=>o.linkType==='directory'))card.append(externalLink(data.directory.label+' ↗',data.directory.url));
 if(optionalStatePicker)card.append(optionalStatePicker);
 const next=node('div',undefined,'next'),button=node('button',data.intent==='CIVIC_ISSUE'?c.generate:say(lang,'Generate Message','செய்தி உருவாக்கு','संदेश बनाएँ'),'primary');button.onclick=()=>actionPanel(card,data,c);next.append(node('strong',c.next),button);card.append(next);
 if(data.followUpOptions?.length){const follow=node('details',undefined,'follow-up');follow.append(node('summary',say(lang,'State grievance and follow-up','மாநில புகார் மற்றும் தொடர் விசாரணை','राज्य शिकायत और आगे पूछताछ')));for(const option of data.followUpOptions)follow.append(renderChannel(option,data));card.append(follow);}
 if(data.accountabilityOptions?.length){const accountability=node('details',undefined,'follow-up');accountability.append(node('summary',say(lang,'Further grievance or information-request options','கூடுதல் புகார் அல்லது தகவல் கோரிக்கை வழிகள்','आगे शिकायत या सूचना माँगने के विकल्प')));for(const option of data.accountabilityOptions)accountability.append(renderChannel({...option,role:option.id==='cpgrams'?'grievance':'information'},{...data,intent:'GOVERNMENT_SERVICE'}));card.append(accountability);}
 root.append(card);root.focus();
}
async function submit(){
 if(busy||!$('ask-form').reportValidity())return;
 if(choiceRequest!==$('request').value)subjectChoice=undefined;
 const requestKey=JSON.stringify([$('request').value,subjectChoice||null]);
 if(requestKey!==stateRequestKey){stateId=undefined;stateRequestKey=requestKey;}
 busy=true;$('submit').disabled=true;document.querySelectorAll('[data-lang],.examples button').forEach(b=>b.disabled=true);$('result').hidden=true;$('status').textContent=content[currentLanguage].loading;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),mode==='strands'?55000:23000);
 try{const response=await fetch('/api/assist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:$('request').value,language:selected,subjectChoice,stateId}),signal:controller.signal});if(!response.ok)throw new Error();result=await response.json();localize(result.language);render(result);$('status').textContent='';}catch{$('status').textContent=content[currentLanguage].error;}finally{clearTimeout(timer);busy=false;$('submit').disabled=false;document.querySelectorAll('[data-lang],.examples button').forEach(b=>b.disabled=false);}
}
$('ask-form').onsubmit=e=>{e.preventDefault();submit();};
document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{selected=b.dataset.lang;localize(selected==='auto'?(result?.language||'en'):selected);if(result)submit();});
try{const response=await fetch('/api/health');if(response.ok)mode=(await response.json()).mode;}catch{}
localize('en');
