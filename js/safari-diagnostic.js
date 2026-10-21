// A separate content-world receipt. DOM access never proves main-world access.
export function runContentDiagnostic(env){
  if(env.top!==env.self||env.location.hostname!=='rickychen-wq.github.io'||env.location.pathname!=='/poke-console/safari-check.html')return;
  const doc=env.document,attribute='data-chen-safari-content-proof';
  const root=doc.documentElement;
  if(!root||root.getAttribute(attribute))return;
  let blocked=0,complete=false,disposed=false;
  const timers=[];
  const snapshot=()=>{
    const policies=[...doc.querySelectorAll('meta[http-equiv]')]
      .filter(meta=>meta.getAttribute('http-equiv')?.toLowerCase()==='content-security-policy')
      .map(meta=>{
        const directives=(meta.getAttribute('content')||'').split(';').map(part=>part.trim().split(/\s+/));
        return ['script-src-elem','script-src','default-src'].map(name=>directives.find(tokens=>tokens[0]===name)).find(Boolean);
      }).filter(Boolean);
    return {version:'0.1.0',contentScriptExecuted:true,scriptPolicyHasUnsafeInline:policies.length?policies.every(tokens=>tokens.includes("'unsafe-inline'")):null,blockedInlineScriptEvents:blocked,observationComplete:complete};
  };
  const publish=()=>{if(!disposed)root.setAttribute(attribute,JSON.stringify(snapshot()));};
  const violation=event=>{
    if(event.disposition==='report')return;
    if(['script-src','script-src-elem'].includes(event.effectiveDirective)&&event.blockedURI==='inline'){
      blocked=Math.min(99,blocked+1);publish();
    }
  };
  const loaded=()=>publish();
  doc.addEventListener('securitypolicyviolation',violation);
  doc.addEventListener('DOMContentLoaded',loaded,{once:true});
  for(const delay of [500,2000])timers.push(env.setTimeout(publish,delay));
  timers.push(env.setTimeout(()=>{
    complete=true;doc.removeEventListener('securitypolicyviolation',violation);
    doc.removeEventListener('DOMContentLoaded',loaded);publish();
  },9000));
  publish();
  return {snapshot,dispose(){disposed=true;for(const timer of timers)env.clearTimeout(timer);doc.removeEventListener('securitypolicyviolation',violation);doc.removeEventListener('DOMContentLoaded',loaded);root.removeAttribute(attribute);}};
}
