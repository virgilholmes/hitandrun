// Camera controls for inspecting original assets, not game movement/physics.
export function createOrbitCamera(){
 const camera={target:[0,0,0],yaw:0.6,pitch:0.25,distance:3.2,radius:1};
 camera.fit=(low,high)=>{
  if(!low.every(Number.isFinite)||!high.every(Number.isFinite)){camera.target=[0,0,0];camera.radius=1;}
  else{camera.target=low.map((v,i)=>(v+high[i])/2);camera.radius=Math.max(.1,Math.hypot(...high.map((v,i)=>v-low[i]))/2);}
  camera.distance=camera.radius*3.2;
 };
 camera.focus=(target,distance)=>{if(target.length!==3||!target.every(Number.isFinite)||!Number.isFinite(distance)||distance<=0)throw new Error('Invalid camera view.');camera.target=[...target];camera.distance=distance;};
 camera.orbit=(dx,dy)=>{camera.yaw-=dx*.008;camera.pitch=Math.max(-1.45,Math.min(1.45,camera.pitch+dy*.008));};
 camera.zoom=delta=>{camera.distance=Math.max(.05,Math.min(camera.radius*100,camera.distance*Math.exp(delta*.001)));};
 camera.eye=()=>[camera.target[0]+Math.sin(camera.yaw)*Math.cos(camera.pitch)*camera.distance,camera.target[1]+Math.sin(camera.pitch)*camera.distance,camera.target[2]+Math.cos(camera.yaw)*Math.cos(camera.pitch)*camera.distance];
 camera.move=(keys,seconds)=>{
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  const right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  const up=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
  const length=Math.hypot(forward,right,up);
  if(!length)return;
  const speed=Math.max(1,camera.distance*.5)*Math.min(.05,Math.max(0,seconds))*(keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1)/length;
  camera.target[0]+=(right*Math.cos(camera.yaw)-forward*Math.sin(camera.yaw))*speed;
  camera.target[1]+=up*speed;
  camera.target[2]+=(-right*Math.sin(camera.yaw)-forward*Math.cos(camera.yaw))*speed;
 };
 return camera;
}
