import {lightingIntro} from './lighting-intro.js';
import {installParallax} from './parallax.js';
import {installOrbit,INITIAL_ORBIT,orbitPose} from './orbit.js';
import {mountSpotlight} from './spotlight.js';
const frame=document.querySelector('#ferrari-viewer');
const stage=document.querySelector('.car-stage');
const input=document.querySelector('.camera-input');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
installParallax(stage,document.querySelector('.camera-track'),reducedMotion);
const introAbort=new AbortController();
mountSpotlight(document.querySelector('.sl'));
document.querySelector('.story-arrow').addEventListener('click',event=>{
  event.preventDefault();
  const story=document.querySelector('#the-story');
  story.scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth'});
  story.focus({preventScroll:true});
});
function fail(){stage.classList.add('load-failed');document.querySelector('.fallback').hidden=false;}
const loadingTimeout=setTimeout(fail,45000);
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)introAbort.abort();});
window.addEventListener('pagehide',()=>{introAbort.abort();clearTimeout(loadingTimeout);},{once:true});
const script=document.createElement('script');
script.src='https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js';
script.onerror=fail;
script.onload=()=>new window.Sketchfab('1.12.1',frame).init('011cad3526e945799d6e98dde6390182',{
  autostart:1,camera:0,dnt:1,preload:innerWidth>760?1:0,scrollwheel:0,dof_circle:0,animation_autoplay:0,transparent:1,
  success(api){
    api.addEventListener('viewerready',async()=>{
      api.setUserInteraction(false);api.setBackground({transparent:true});api.setFov(27);
      clearTimeout(loadingTimeout);stage.classList.remove('load-failed');document.querySelector('.fallback').hidden=true;
      const pose=orbitPose(INITIAL_ORBIT,frame.clientWidth/frame.clientHeight);
      api.setCameraLookAt(pose.position,pose.target,0);
      installOrbit(input,frame,api,reducedMotion);
      await lightingIntro(api,stage,{reduced:reducedMotion.matches,signal:introAbort.signal});
    });
    api.start();
  },error:fail,
});
document.head.append(script);
