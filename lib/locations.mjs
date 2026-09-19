import {readFileSync} from 'node:fs';
// Direct destinations are curated; directory queries are encoded on one official host.
const aliases=[
 {id:'tn',name:'Tamil Nadu',aliases:['tamil nadu','tamilnadu','தமிழ்நாடு','தமிழ் நாடு','तमिलनाडु'],cities:[['chennai','Chennai',['chennai','madras','சென்னை','चेन्नई']],['coimbatore','Coimbatore',['coimbatore','kovai','கோயம்புத்தூர்','கோவை']],['madurai','Madurai',['madurai','மதுரை']],['salem','Salem',['salem','சேலம்']],['trichy','Tiruchirappalli',['trichy','tiruchirappalli','திருச்சி']]]},
 {id:'mh',name:'Maharashtra',aliases:['maharashtra','महाराष्ट्र','மகாராஷ்டிரா'],cities:[['mumbai','Mumbai',['mumbai','bombay','मुंबई','மும்பை']],['pune','Pune',['pune','पुणे','புனே']],['nagpur','Nagpur',['nagpur','नागपुर']]]},
 {id:'ka',name:'Karnataka',aliases:['karnataka','கர்நாடகா','कर्नाटक'],cities:[['bengaluru','Bengaluru',['bengaluru','bangalore','பெங்களூரு','பெங்களூர்','बेंगलुरु','बैंगलोर']],['mysuru','Mysuru',['mysuru','mysore','मैसूर']]]},
 {id:'dl',name:'Delhi',aliases:['delhi','दिल्ली','டெல்லி'],cities:[]}
];
const fold=text=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const dataset=JSON.parse(readFileSync(new URL('../data/india-locations.json',import.meta.url),'utf8'));
const regions=dataset.regions.map(r=>{
 const extra=aliases.find(a=>a.id===r.id);
 const cities=r.cities.map(c=>{const known=extra?.cities.find(([,name,names])=>[name,...names].some(n=>fold(n)===fold(c.name)));return known||[c.id,c.name,[c.name]];});
 for(const city of extra?.cities||[])if(!cities.some(c=>c[0]===city[0]))cities.push(city);
 const unique=[...new Map(cities.map(c=>[fold(c[1]),c])).values()].sort((a,b)=>a[1].localeCompare(b[1]));
 return {...r,aliases:[r.name,...(extra?.aliases||[])],cities:unique};
});
const word=/[\p{L}\p{M}\p{N}]/u;
function mentions(text,alias){const value=fold(alias);let at=text.indexOf(value);while(at!==-1){if((at===0||!word.test(text[at-1]))&&(at+value.length===text.length||!word.test(text[at+value.length])))return true;at=text.indexOf(value,at+1);}return false;}
const exactLocations=new Map();
for(const r of regions){for(const [,name,names] of r.cities)for(const alias of [name,...names])exactLocations.set(fold(`${alias}, ${r.name}`),{status:'resolved',state:r.id,stateName:r.name,city:r.cities.find(c=>c[1]===name)[0],name:`${name}, ${r.name}`});}
export function resolveLocation(text=''){
 text=fold(text);
 const exact=exactLocations.get(fold(text.trim()));if(exact)return {...exact};
 const exactStates=regions.filter(r=>r.aliases.some(a=>fold(a)===fold(text.trim())));
 if(exactStates.length===1){const r=exactStates[0];return {status:'resolved',state:r.id,stateName:r.name,name:r.name};}
 const parts=text.split(',').map(p=>p.trim());
 if(parts.length===2){const r=regions.find(r=>r.aliases.some(a=>fold(a)===parts[1]));const knownElsewhere=regions.some(s=>s.id!==r?.id&&s.cities.some(([,name,names])=>[name,...names].some(n=>fold(n)===parts[0])));if(r&&!knownElsewhere&&!r.cities.some(([,name,names])=>[name,...names].some(n=>fold(n)===parts[0])))return {status:'resolved',state:r.id,stateName:r.name,name:`${parts[0]}, ${r.name}`,customCity:true};}
 const hits=[];for(const region of regions){const cities=region.cities.filter(([, ,aliases])=>aliases.some(a=>mentions(text,a)));if(cities.length||region.aliases.some(a=>mentions(text,a)))hits.push({state:region.id,stateName:region.name,cities});}
 if(hits.length>1||hits.some(h=>h.cities.length>1))return {status:'ambiguous'};
 if(!hits.length)return {status:text.trim()?'unsupported':'missing'};
 const h=hits[0],city=h.cities[0];return {status:'resolved',state:h.state,stateName:h.stateName,city:city?.[0],name:city?`${city[1]}, ${h.stateName}`:h.stateName};
}
const link=(label,url,scope,reference=url)=>({label,url,portal:url,scope,reference,verified:'2026-09-18',applicable:true});
const directory=link('National Government Services Portal · Service directory','https://services.india.gov.in/','India');
export function regionalSource(subject,location){
 if(location.status!=='resolved')return null;
 const {state,city}=location;
 if(state==='tn'){
  if(['income','residence'].includes(subject))return link('Tamil Nadu e-Sevai','https://www.tnesevai.tn.gov.in/','Tamil Nadu','https://tnesevai.tn.gov.in/Citizen/Pages/ServiceList.aspx');
  if(['birth','death'].includes(subject))return link('Tamil Nadu Civil Registration · Certificate downloads','https://www.crstn.org/birth_death_tn/nest_avail.jsp','Tamil Nadu · registered events covered by CRS');
  if(['water','drainage'].includes(subject))return link('PUNAL · Water and drainage complaints','https://punal.tn.gov.in/','Tamil Nadu','https://punal.tn.gov.in/faq.html');
  if(subject==='property')return city==='chennai'?link('Greater Chennai Corporation · Property tax','https://chennaicorporation.gov.in/new_site/property-tax-online-payment/','Greater Chennai Corporation limits'):link('Tamil Nadu Urban ePay · Property search','https://tnurbanepay.tn.gov.in/PT_PropertySearch.aspx','Participating Tamil Nadu urban local bodies');
  if(city==='chennai'&&['streetlight','garbage','road'].includes(subject))return link('Greater Chennai Corporation · Grievances','https://erp.chennaicorporation.gov.in/pgr/','Greater Chennai Corporation limits');
 }
 if(state==='mh'){
  if(['income','residence'].includes(subject))return link('Aaple Sarkar · Revenue services','https://aaplesarkar.mahaonline.gov.in/en/Login/Login','Maharashtra');
  if(city==='mumbai'&&subject==='property')return link('BMC · Property tax','https://ptaxportal.mcgm.gov.in/CitizenPortal','Brihanmumbai Municipal Corporation limits');
  if(city==='mumbai'&&['garbage','road','streetlight','water','drainage'].includes(subject))return link('BMC · Grievance portal','https://marg.mcgm.gov.in/MARG/welcomePage.html','BMC jurisdiction; confirm responsible asset owner');
 }
 if(state==='ka'&&subject==='income')return link('Karnataka · Income certificate guidance','https://tumkur.nic.in/en/service/apply-for-income-certificate/','Karnataka · official district guidance linking to Nadakacheri');
 if(state==='dl'){
  if(subject==='income')return link('Delhi e-District · Income certificate','https://edistrict.delhigovt.nic.in/','Delhi','https://dmwest.delhi.gov.in/service/income-certificate/');
  // Delhi contains multiple municipal jurisdictions: never assume MCD from city alone.
 }
 return null;
}
export function locationOptions(subject){
 if(!['birth','death','income','residence','property','streetlight','garbage','road','drainage','water'].includes(subject))return [];
 return regions.map(region=>{
  const base={status:'resolved',state:region.id};
  const cities=region.cities.map(([id,name])=>({id,name,value:`${name}, ${region.name}`}));
  return {id:region.id,name:region.name,value:region.name,stateWide:true,directStateLink:Boolean(regionalSource(subject,base)),cities};
 });
}
const serviceTerms={birth:'birth certificate',death:'death certificate',income:'income certificate',residence:'residence certificate',property:'property tax',streetlight:'streetlight complaint',garbage:'garbage collection complaint',road:'road damage complaint',drainage:'drainage complaint',water:'water supply complaint'};
export function directorySource(subject,location){
 if(location.status!=='resolved')return {...directory,applicable:false,isDirectory:true};
 const query=`${serviceTerms[subject]} ${location.name}`;
 const url=new URL('https://www.india.gov.in/search');url.searchParams.set('search',query);url.searchParams.set('type','services');
 return {...directory,url:url.href,portal:undefined,scope:location.name,applicable:false,isDirectory:true,isSearch:true,query};
}
const copy={
 en:{missing:'Choose an available state and city below to find the service link.',ambiguous:'More than one location was found. Enter a single city and its state.',unsupported:'We do not yet have a verified regional link for this location and service. Use the official service directory and select your state; add your city for municipal services.',matched:'Official destination selected for {place}. Confirm that the portal covers your local authority and case.',documents:'Confirm the document list on the selected regional portal or with the responsible local authority.',label:'State / city',placeholder:'e.g. Tamil Nadu, Chennai, Mumbai or Delhi',update:'Update service links',directory:'Open official service directory ↗',scope:'Portal coverage',locationHint:'For birth/death certificates use the place of the event; for property tax use the property location.'},
 ta:{missing:'சேவை இணைப்பைப் பெற கீழே உள்ள மாநிலம் மற்றும் நகரப் பட்டியலிலிருந்து தேர்ந்தெடுக்கவும்.',ambiguous:'ஒன்றுக்கு மேற்பட்ட இடங்கள் உள்ளன. ஒரு நகரத்தையும் அதன் மாநிலத்தையும் மட்டும் குறிப்பிடுங்கள்.',unsupported:'இந்த இடம் மற்றும் சேவைக்கான சரிபார்க்கப்பட்ட இணைப்பு இன்னும் இல்லை. அதிகாரப்பூர்வ சேவைப் பட்டியலில் மாநிலத்தைத் தேர்ந்தெடுக்கவும்; உள்ளாட்சி சேவைகளுக்கு நகரத்தையும் சேர்க்கவும்.',matched:'{place} இடத்திற்கான அதிகாரப்பூர்வ தளம் தேர்ந்தெடுக்கப்பட்டது. உங்கள் உள்ளாட்சி அமைப்புக்கும் தேவைக்கும் பொருந்துகிறதா என உறுதிப்படுத்துங்கள்.',documents:'தேர்ந்தெடுத்த மாநிலத் தளத்தில் அல்லது உள்ளூர் அதிகாரியிடம் ஆவணப் பட்டியலை உறுதிப்படுத்துங்கள்.',label:'மாநிலம் / நகரம்',placeholder:'எ.கா. தமிழ்நாடு, சென்னை, மும்பை, டெல்லி',update:'சேவை இணைப்புகளைப் புதுப்பிக்க',directory:'அதிகாரப்பூர்வ சேவைப் பட்டியலைத் திறக்க ↗',scope:'தளத்தின் சேவைப் பகுதி',locationHint:'பிறப்பு/இறப்புக்கு நிகழ்ந்த இடத்தையும், சொத்து வரிக்கு சொத்து இருக்கும் இடத்தையும் குறிப்பிடுங்கள்.'},
 hi:{missing:'सेवा लिंक के लिए नीचे दी गई सूची से राज्य और शहर चुनें।',ambiguous:'एक से अधिक स्थान मिले। एक शहर और उसका राज्य लिखें।',unsupported:'इस स्थान और सेवा का सत्यापित क्षेत्रीय लिंक अभी उपलब्ध नहीं है। आधिकारिक सेवा निर्देशिका में अपना राज्य चुनें; नगरपालिका सेवाओं के लिए शहर भी लिखें।',matched:'{place} के लिए आधिकारिक पोर्टल चुना गया है। अपने स्थानीय निकाय और मामले के लिए इसकी उपयुक्तता जाँचें।',documents:'चुने गए क्षेत्रीय पोर्टल या स्थानीय अधिकारी से दस्तावेज़ों की सूची की पुष्टि करें।',label:'राज्य / शहर',placeholder:'जैसे तमिलनाडु, चेन्नई, मुंबई या दिल्ली',update:'सेवा लिंक अपडेट करें',directory:'आधिकारिक सेवा निर्देशिका खोलें ↗',scope:'पोर्टल का क्षेत्र',locationHint:'जन्म/मृत्यु के लिए घटना का स्थान और संपत्ति कर के लिए संपत्ति का स्थान लिखें।'}
};
export function routeResult(result,input){
 if(result.intent==='UNKNOWN')return result;
 const location=resolveLocation(input.location?.trim()||input.text);
 // No place mentioned in the request is the missing-location case, not an unsupported city.
 if(!input.location?.trim()&&location.status==='unsupported')location.status='missing';
 const source=regionalSource(result.subject,location),c=copy[result.language];
 const options=locationOptions(result.subject);
 const searchNotice={en:'A direct service link has not been verified for this location. The official directory search below includes your service and location; results may be broader or empty.',ta:'இந்த இடத்திற்கான நேரடி சேவை இணைப்பு சரிபார்க்கப்படவில்லை. கீழுள்ள அதிகாரப்பூர்வ தேடலில் உங்கள் சேவையும் இடமும் சேர்க்கப்பட்டுள்ளன; முடிவுகள் விரிவாகவோ இல்லாமலோ இருக்கலாம்.',hi:'इस स्थान के लिए सीधा सेवा लिंक सत्यापित नहीं है। नीचे आधिकारिक खोज में आपकी सेवा और स्थान शामिल हैं; परिणाम व्यापक या खाली हो सकते हैं।'};
 const regional={...result,locationOptions:options,locationResolution:location,needsLocation:location.status!=='resolved'&&options.length>0,locationCopy:c,source:source||directorySource(result.subject,location),notice:source?c.matched.replace('{place}',location.name):location.status==='resolved'?searchNotice[result.language]:c[location.status]};
 if(location.status==='resolved')regional.entities={...result.entities,location:input.location?.trim()||location.name};
 // Never carry Tamil Nadu document requirements into another state's result.
 if(['income','residence'].includes(result.subject)&&location.state!=='tn')regional.documents=[c.documents];
 if(regional.documents)regional.checklist=[...regional.documents,...regional.steps];
 return regional;
}
