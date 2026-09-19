import {handleRequest,jsonResponse,maxBodyBytes} from './lib/http.mjs';

export function createLambdaHandler(options={}){
 return async event=>{
  const context=event?.requestContext,domain=context?.domainName;
  if(event?.version!=='2.0'||!context?.http?.method||typeof domain!=='string'||! /^[a-zA-Z0-9.-]+$/.test(domain))return jsonResponse(400,{error:'INVALID_GATEWAY_EVENT'});
  if(typeof event.body!=='undefined'&&typeof event.body!=='string')return jsonResponse(400,{error:'INVALID_GATEWAY_EVENT'});
  // Reject before decoding as well as after, to bound base64 request memory.
  if((event.body?.length||0)>Math.ceil(maxBodyBytes/3)*4)return jsonResponse(413,{error:'REQUEST_TOO_LARGE'});
  const body=Buffer.from(event.body||'',event.isBase64Encoded?'base64':'utf8');
  if(body.length>maxBodyBytes)return jsonResponse(413,{error:'REQUEST_TOO_LARGE'});
  const url=(event.rawPath||'/')+(event.rawQueryString?`?${event.rawQueryString}`:'');
  const response=await handleRequest({method:context.http.method,url,headers:event.headers,body,origin:`https://${domain}`},options);
  return {...response,isBase64Encoded:false};
 };
}
export const handler=createLambdaHandler();
