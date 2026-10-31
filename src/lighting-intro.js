const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t*t*(3-2*t);
const vector=(value,n)=>Array.from({length:n},(_,i)=>value[i]);
const normalize=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function lightMatrix(direction,original){
  const z=normalize(direction),x=normalize(cross([0,0,1],z)),y=cross(z,x);
  return [...x,0,...y,0,...z,0,original[12],original[13],original[14],1];
}
function read(api,name,...args){
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Lighting read timed out')),2500);
    api[name](...args,(error,data)=>{clearTimeout(timeout);error?reject(error):resolve(data);});
  });
}

export async function lightingIntro(api,stage,{reduced=false,signal}={}){
  const finishVisual=()=>{
    stage.style.setProperty('--day','1');
    stage.classList.add('is-ready','intro-complete');
    stage.dataset.phase='day';
  };
  if(reduced||signal?.aborted){finishVisual();return;}
  let environment,lights,enabled;
  try{
    [environment,enabled,...lights]=await Promise.all([
      read(api,'getEnvironment'),read(api,'isLightFeatureEnabled'),
      ...[0,1,2].map(i=>read(api,'getLight',i)),
    ]);
  }catch{finishVisual();return;}
  const originals=lights.map(light=>({...light,color:vector(light.color,3),matrix:vector(light.matrix,16)}));
  const colors=[[.015,.24,1],[1,.035,.006],[.22,.015,.12]];
  const directions=[[-.6,.9,.45],[-.3,-.9,.38],[.15,.1,1]];
  const intensities=[.66,.8,.06];
  function apply(t){
    api.setEnvironment({exposure:environment.exposure*lerp(.035,1,t),lightIntensity:environment.lightIntensity*lerp(.08,1,t)});
    originals.forEach((original,i)=>{
      const direction=directions[i].map((v,k)=>lerp(v,original.matrix[8+k],t));
      api.setLight(i,{
        enabled:true,shadowEnabled:original.shadowEnabled,
        color:colors[i].map((v,k)=>lerp(v,original.color[k],t)),
        intensity:lerp(intensities[i],original.enabled?original.intensity:0,t),
        matrix:lightMatrix(direction,original.matrix),
      });
    });
  }
  const restore=()=>{
    api.setEnvironment({exposure:environment.exposure,lightIntensity:environment.lightIntensity});
    originals.forEach((original,i)=>api.setLight(i,{enabled:original.enabled,shadowEnabled:original.shadowEnabled,color:original.color,intensity:original.intensity,matrix:original.matrix}));
    api.setLightFeatureEnabled(enabled);
  };
  if(signal?.aborted){finishVisual();return;}
  api.setLightFeatureEnabled(true);
  apply(0);
  // Give the viewer a paint to apply the dark lights before exposing the model.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  stage.classList.add('is-ready');
  stage.dataset.phase='night';
  await new Promise(resolve=>{
    let raf=0,done=false;
    const started=performance.now();
    const finish=()=>{
      if(done)return;
      done=true;cancelAnimationFrame(raf);restore();finishVisual();
      signal?.removeEventListener('abort',finish);resolve();
    };
    signal?.addEventListener('abort',finish,{once:true});
    if(signal?.aborted){finish();return;}
    const tick=now=>{
      const raw=Math.max(0,Math.min(1,(now-started-2200)/5200));
      const t=ease(raw);
      stage.style.setProperty('--day',String(t));
      if(raw>0)stage.dataset.phase='dawn';
      apply(t);
      if(raw===1)finish();else raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
  });
}
