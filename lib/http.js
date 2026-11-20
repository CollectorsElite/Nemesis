import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { database, attachmentsDir } from './storage.js';

const publicDir = path.resolve(import.meta.dirname, '../frontend');
const routes = [];
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
function inside(base, filename) {
  return filename.startsWith(path.resolve(base)+path.sep);
}
function sendFile(raw, file, head) {
  const meta = fs.statSync(file, {throwIfNoEntry:false});
  if (!meta?.isFile()) { raw.writeHead(404); raw.end(); return; }
  raw.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
  raw.setHeader('Content-Length',meta.size);
  if (head) return raw.end();
  fs.createReadStream(file).on('error',()=>raw.destroy()).pipe(raw);
}
async function request(req, raw) {
  const fail = (status, error) => {
    raw.writeHead(status,{'Content-Type':'application/json'}); raw.end(JSON.stringify({ok:false,error}));
  };
  raw.setHeader('X-Content-Type-Options','nosniff');
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if (pathname.includes('\0')) return fail(400,'INVALID_PATH');
  const method = req.method;
  const route = routes.find(r=>r.method===method && r.pattern.test(pathname));
  if (!route) {
    if (!['GET','HEAD'].includes(method)) return fail(404,'NOT_FOUND');
    const file = path.resolve(publicDir,'.'+(pathname==='/admin/' ? '/admin_dashboard.html' : pathname));
    if (!inside(publicDir,file)) return fail(404,'NOT_FOUND');
    return sendFile(raw,file,method==='HEAD');
  }
  req.params = route.pattern.exec(pathname)?.groups || {};
  req.cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(part=>{
    const i=part.indexOf('='); return [part.slice(0,i).trim(),part.slice(i+1)];
  }));
  req.body = {};
  if (!['GET','HEAD'].includes(method)) {
    if (req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) return fail(403,'ORIGIN');
    const chunks=[]; let bytes=0;
    for await (const chunk of req) {
      bytes+=chunk.length;
      if (bytes>65536) return fail(413,'BODY_TOO_LARGE');
      chunks.push(chunk);
    }
    if (bytes) {
      if (!req.headers['content-type']?.startsWith('application/json')) return fail(415,'INVALID_TYPE');
      try {req.body=JSON.parse(Buffer.concat(chunks).toString());} catch {return fail(400,'INVALID_JSON');}
    }
  }
  raw.setHeader('Cache-Control','no-store');
  let status=200, body, file;
  const res = {
    status(n) {status=n;return this;},
    json(value) {body=JSON.stringify(value);raw.setHeader('Content-Type','application/json; charset=utf-8');},
    redirect(to) {status=302;raw.setHeader('Location',to);},
    cookie(key,value,opts) {
      raw.setHeader('Set-Cookie',key+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+Math.floor(opts.maxAge/1000)+(opts.secure?'; Secure':''));
    },
    clearCookie(key) {this.cookie(key,'',{maxAge:0,secure:process.env.NODE_ENV==='production'});},
    attachment(filename, name) {
      if (!inside(attachmentsDir,path.resolve(filename)) || !fs.existsSync(filename)) return this.status(404).json({ok:false,error:'NOT_FOUND'});
      file=filename;
      const inline=path.extname(filename).toLowerCase()==='.html';
      raw.setHeader('Content-Disposition',(inline?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(name));
      if(inline) raw.setHeader('Content-Security-Policy',"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'");
    }
  };
  let index=0;
  const next=()=>route.chain[index++](req,res,next);
  // All game writes are synchronous. Nothing can interleave between BEGIN and COMMIT.
  if (route.atomic) {
    database.exec('BEGIN IMMEDIATE');
    try {
      next();
      database.exec(status>=400?'ROLLBACK':'COMMIT');
    } catch (e) {database.exec('ROLLBACK');throw e;}
  } else await next();
  raw.statusCode=status;
  if(file) return sendFile(raw,file,false);
  raw.end(body);
}
export const app = {
  listen(port, ready) {
    const server=http.createServer((req,res)=>request(req,res).catch(e=>{
      console.error(e.message);
      if (!res.headersSent) res.writeHead(e instanceof URIError?400:500);
      res.end();
    }));
    server.listen(port,'0.0.0.0',ready);
    process.on('SIGTERM',()=>server.close(()=>{database.close();process.exit(0);}));
  }
};
for (const method of ['GET','POST','PATCH','DELETE']) {
  app[method.toLowerCase()]=(url,...chain)=>{
    const pattern=new RegExp('^'+url.replace(/:(\w+)/g,'(?<$1>[^/]+)')+'$');
    const atomic=(method!=='GET'||url==='/api/game/state') && chain.at(-1).constructor.name!=='AsyncFunction';
    routes.push({method,pattern,chain,atomic});
  };
}
