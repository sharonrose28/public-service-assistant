import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {answer,bedrockConfigured} from './lib/assistant.mjs';
const publicFiles={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/content.js':'content.js','/catalog.js':'catalog.js'};
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
export function createServer(options={}) {return http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 const path=new URL(req.url,'http://localhost').pathname;
 try{
  if(req.method==='GET' && path==='/api/health') return json(res,200,{mode:bedrockConfigured(options.env||process.env)?'bedrock':'local'});
  if(req.method==='POST' && path==='/api/assist') {
   // Only this local UI can trigger billable inference from a browser.
   if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) return json(res,403,{error:'ORIGIN_REJECTED'});
   if(!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{error:'JSON_REQUIRED'});
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>12000){json(res,413,{error:'REQUEST_TOO_LARGE'});return;}chunks.push(chunk);}
   const data=Buffer.concat(chunks).toString('utf8');
   let input;try{input=JSON.parse(data);}catch{return json(res,400,{error:'INVALID_JSON'});}
   return json(res,200,await answer(input,options));
  }
  if(req.method==='GET' && publicFiles[path]) {const file=publicFiles[path];const body=await readFile(new URL(`./public/${file}`,import.meta.url));res.writeHead(200,{'Content-Type':types[file.split('.').pop()]});return res.end(body);}
  json(res,404,{error:'NOT_FOUND'});
 }catch(error){json(res,error.message==='INVALID_INPUT'?400:500,{error:error.message==='INVALID_INPUT'?'INVALID_INPUT':'SERVER_ERROR'});}
 });}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){const port=Number(process.env.PORT)||3000;createServer().listen(port,'127.0.0.1',()=>console.log(`Public Service Assistant: http://localhost:${port}`));}
