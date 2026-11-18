const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");

const src=fs.readFileSync("public/js/tarimas.js","utf8");

function montar(allDocs){
  const notices=[]; const writes=[];
  const ts=d=>({toMillis:()=>d.getTime()});
  const snapshot={docs:allDocs.map(d=>({id:d.id,ref:d.id,data:()=>d.data}))};
  const query={orderBy:()=>({get:async()=>snapshot}),doc:()=>"nuevo"};
  const firestore=()=>({collection:()=>query,
    batch:()=>({set:(r,p)=>writes.push({r,p}),update:(r,p)=>writes.push({r,p}),commit:async()=>{}})});
  firestore.Timestamp={fromDate:ts};
  const inputs={"tarima-cantidad":{value:"20"},"tarima-fecha":{value:"2026-10-16"},
    "tarima-destino":{value:"Walmart"},"tarima-observacion":{value:""},"btn-save-tarima":{}};
  const ctx=vm.createContext({
    window:{currentUserData:{displayName:"Editor"},permissions:{canCreate:true}},
    AccessControl:{level:()=>"write"},document:{getElementById:id=>inputs[id]},
    firebase:{firestore,auth:()=>({currentUser:{uid:"e"}})},
    showToast:(m,t)=>notices.push({m,t}),setButtonLoading(){},console
  });
  vm.runInContext(src,ctx);
  let cerrado=false;
  ctx.window.Tarimas.hideForm=()=>{cerrado=true};
  return {Tarimas:ctx.window.Tarimas,notices,writes,get cerrado(){return cerrado}};
}

const SALIDA_LIBRE=
  {id:"ent",data:{tipo:"ingreso",cantidad:10,fecha:{toMillis:()=>new Date(2026,9,15,12).getTime()},totalDespues:10}};

test("salida que deja saldo negativo SE REGISTRA y avisa",async()=>{
  const c=montar([SALIDA_LIBRE]);
  await c.Tarimas.saveMovimiento("salida");
  assert.equal(c.cerrado,true,"el modal debe cerrarse (se guardo)");
  assert.ok(c.notices.some(n=>n.t==="warning"&&/existencia queda en -10/.test(n.m)),"debe avisar del saldo negativo");
  assert.ok(c.writes.length>0,"debe escribir en Firestore");
});

test("entrada normal no muestra advertencia",async()=>{
  const c=montar([SALIDA_LIBRE]);
  await c.Tarimas.saveMovimiento("ingreso");
  assert.equal(c.cerrado,true);
  assert.ok(!c.notices.some(n=>n.t==="warning"),"sin advertencia de saldo");
});
