import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {handleRequest,jsonResponse,maxBodyBytes} from './lib/http.mjs';
export function configuredPublicOrigin(env=process.env){
 if(env.PUBLIC_ORIGIN===undefined)return null;
 try{
  const value=env.PUBLIC_ORIGIN;
  if(typeof value!=='string'||value.trim()!==value)throw Error();
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error();
  return url.origin;
 }catch{throw Error('INVALID_PUBLIC_ORIGIN: use a complete HTTPS origin without credentials, path, query or fragment');}
}
export function createServer(options={}){
 const publicOrigin=configuredPublicOrigin(options.env||process.env);
 return http.createServer(async(req,res)=>{
  const send=({statusCode,headers,body})=>{res.writeHead(statusCode,headers);res.end(body);};
  try{
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>maxBodyBytes)return send(jsonResponse(413,{error:'REQUEST_TOO_LARGE'}));chunks.push(chunk);}
   // Explicit deployment configuration handles TLS termination; forwarded headers are untrusted.
   send(await handleRequest({method:req.method,url:req.url,headers:req.headers,body:Buffer.concat(chunks),origin:publicOrigin||`http://${req.headers.host}`},options));
  }catch{send(jsonResponse(500,{error:'SERVER_ERROR'}));}
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const port=Number(process.env.PORT)||3000,host=process.env.HOST||'127.0.0.1';
 createServer().listen(port,host,()=>console.log(`Public Service Assistant: http://${host}:${port}`));
}
