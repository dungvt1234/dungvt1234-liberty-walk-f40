export const ORBIT_LIMITS={minElevation:.06,maxElevation:.72,minDistance:3.5,maxDistance:12};
export const INITIAL_ORBIT={azimuth:Math.atan2(-4.9,6.6),elevation:.14,distance:8.3};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function clampOrbit(state){return {...state,elevation:clamp(state.elevation,ORBIT_LIMITS.minElevation,ORBIT_LIMITS.maxElevation),distance:clamp(state.distance,ORBIT_LIMITS.minDistance,ORBIT_LIMITS.maxDistance)};}
export function orbitPose(state,aspect){
  const safe=clampOrbit(state),r=safe.distance*Math.max(1,1.55/Math.max(.25,aspect));
  return {position:[Math.cos(safe.azimuth)*r*Math.cos(safe.elevation),Math.sin(safe.azimuth)*r*Math.cos(safe.elevation),.6+r*Math.sin(safe.elevation)],target:[0,0,.6]};
}
export function installOrbit(input,frame,api,reducedMotion){
  let desired={...INITIAL_ORBIT},current={...desired},raf=0,previous=0,pinch=0;
  const pointers=new Map();
  const paint=()=>{const pose=orbitPose(current,frame.clientWidth/frame.clientHeight);api.setCameraLookAt(pose.position,pose.target,0);};
  function tick(now){
    raf=0;const blend=reducedMotion.matches?1:1-Math.exp(-Math.min(64,now-previous||16)/75);previous=now;
    for(const key of Object.keys(current))current[key]+=(desired[key]-current[key])*blend;
    paint();if(Object.keys(current).some(key=>Math.abs(current[key]-desired[key])>.0001))raf=requestAnimationFrame(tick);
  }
  function update(){desired=clampOrbit(desired);if(!raf){previous=performance.now();raf=requestAnimationFrame(tick);}}
  const distance=()=>{const [a,b]=[...pointers.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
  input.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    input.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});pinch=distance();input.classList.add('is-dragging');
  });
  input.addEventListener('pointermove',event=>{
    const old=pointers.get(event.pointerId);if(!old)return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1){desired.azimuth-=(event.clientX-old.x)*.006;desired.elevation+=(event.clientY-old.y)*.003;}
    else{const next=distance();if(pinch>0&&next>0)desired.distance*=pinch/next;pinch=next;}
    update();
  });
  function release(event){pointers.delete(event.pointerId);pinch=distance();if(!pointers.size)input.classList.remove('is-dragging');}
  for(const name of ['pointerup','pointercancel','lostpointercapture'])input.addEventListener(name,release);
  input.addEventListener('wheel',event=>{
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
    const next=clamp(desired.distance*Math.exp(clamp(delta,-300,300)*.0015),ORBIT_LIMITS.minDistance,ORBIT_LIMITS.maxDistance);
    if(next===desired.distance)return;
    event.preventDefault();desired.distance=next;update();
  },{passive:false});
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft')desired.azimuth+=.15;
    else if(event.key==='ArrowRight')desired.azimuth-=.15;
    else if(event.key==='ArrowUp')desired.elevation+=.06;
    else if(event.key==='ArrowDown')desired.elevation-=.06;
    else if(['+','='].includes(event.key))desired.distance*=.88;
    else if(event.key==='-')desired.distance/=.88;
    else if(event.key==='Home')desired={...INITIAL_ORBIT};
    else return;
    event.preventDefault();update();
  });
  window.addEventListener('resize',paint);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',paint);},{once:true});
  paint();
}
