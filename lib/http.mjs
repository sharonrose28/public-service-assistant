import {readFile} from 'node:fs/promises';
import {configuredProvider} from './model.mjs';
import {workflow,understand,complaintDraft,messageDraftResponse} from './workflow.mjs';
import {locationOptions} from './locations.mjs';

export const maxBodyBytes=12000;
const publicFiles={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/content.js':'content.js','/catalog.js':'catalog.js','/location-data.json':'../data/india-locations.json','/location-data-license.txt':'../data/LOCATION-DATA-LICENSE.txt'};
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',txt:'text/plain; charset=utf-8'};
const securityHeaders={
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
export function jsonResponse(statusCode,value){return {statusCode,headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(value)};}

// Both adapters supply an origin derived from their trusted transport, never a forwarded header.
export async function handleRequest({method,url,headers={},body='',origin},options={}){
 try{
  const parsedUrl=new URL(url,'http://localhost'),path=parsedUrl.pathname;
  const h=Object.fromEntries(Object.entries(headers).map(([key,value])=>[key.toLowerCase(),value]));
  if(method==='GET'&&path==='/api/health')return jsonResponse(200,{mode:configuredProvider(options.env||process.env)});
  if(method==='GET'&&path==='/api/locations'){
   const stateId=parsedUrl.searchParams.get('stateId'),regions=locationOptions('birth');
   return jsonResponse(200,stateId?regions.find(r=>r.id===stateId)||null:regions.map(({cities,...r})=>r));
  }
  if(method==='POST'&&['/api/assist','/api/understand','/api/resolve-service','/api/complaint-draft','/api/message-draft'].includes(path)){
   if(h.origin&&h.origin!==origin)return jsonResponse(403,{error:'ORIGIN_REJECTED'});
   if(!h['content-type']?.startsWith('application/json'))return jsonResponse(415,{error:'JSON_REQUIRED'});
   if(Buffer.byteLength(body)>maxBodyBytes)return jsonResponse(413,{error:'REQUEST_TOO_LARGE'});
   let input;try{input=JSON.parse(body.toString());}catch{return jsonResponse(400,{error:'INVALID_JSON'});}
   const action=path==='/api/understand'?understand:path==='/api/complaint-draft'?complaintDraft:path==='/api/message-draft'?messageDraftResponse:workflow;
   return jsonResponse(200,await action(input,options));
  }
  if(method==='GET'&&Object.hasOwn(publicFiles,path)){
   const file=publicFiles[path],body=await readFile(new URL(`../public/${file}`,import.meta.url),'utf8');
   return {statusCode:200,headers:{...securityHeaders,'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-cache'},body};
  }
  return jsonResponse(404,{error:'NOT_FOUND'});
 }catch(error){return jsonResponse(error.message==='INVALID_INPUT'?400:500,{error:error.message==='INVALID_INPUT'?'INVALID_INPUT':'SERVER_ERROR'});}
}
