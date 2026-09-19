import {mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const base='https://api.github.com/repos/dr5hn/countries-states-cities-database';
async function get(url,json=true){const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return json?r.json():r.text();}
const release=await get(`${base}/releases/latest`);
const asset=release.assets.find(a=>a.name==='json-cities.json.gz');
if(!asset)throw Error('City export missing');
const commit=await get(`${base}/commits/master`);
const raw=`https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/${commit.sha}`;
const states=(await get(`${raw}/json/states.json`)).filter(s=>s.country_code==='IN');
const response=await fetch(asset.browser_download_url);if(!response.ok)throw Error('City download failed');
const cities=JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer()))).filter(c=>c.country_code==='IN');
const regions=states.map(s=>({id:s.iso2.toLowerCase(),name:s.name,type:s.type,cities:cities.filter(c=>c.state_id===s.id).map(c=>({id:String(c.id),name:c.name})).sort((a,b)=>a.name.localeCompare(b.name))})).sort((a,b)=>a.name.localeCompare(b.name));
if(regions.length!==36||cities.length<4000)throw Error('Unexpected dataset coverage; review before importing');
await mkdir(new URL('../data/',import.meta.url),{recursive:true});
await writeFile(new URL('../data/india-locations.json',import.meta.url),JSON.stringify({source:'https://github.com/dr5hn/countries-states-cities-database',license:'ODbL-1.0',release:release.tag_name,stateCommit:commit.sha,importedAt:new Date().toISOString(),regions},null,2)+'\n');
await writeFile(new URL('../data/LOCATION-DATA-LICENSE.txt',import.meta.url),await get(`${raw}/LICENSE`,false));
console.log(`${regions.length} states/UTs; ${cities.length} city/town/locality records imported`);
