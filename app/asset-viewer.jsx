'use client';
import { useEffect, useRef, useState } from 'react';
import { createRenderer } from '../lib/renderer.mjs';
export default function AssetViewer({scene}) {
  const canvas=useRef(null), renderer=useRef(null);
  const [names,setNames]=useState([]),[selected,setSelected]=useState(''),[error,setError]=useState(''),[ready,setReady]=useState(false);
  useEffect(()=>{
    let cancelled=false,active=null;
    setError('');setReady(false);setNames([]);
    createRenderer(canvas.current,scene,{onError:e=>{if(!cancelled)setError(e.message);}}).then(r=>{
      if(cancelled){r.dispose();return;}
      active=r;renderer.current=r;setNames(r.names);setSelected(r.selected);setReady(true);
    }).catch(e=>{if(!cancelled)setError(e.message);});
    return ()=>{cancelled=true;active?.dispose();renderer.current=null;};
  },[scene]);
  return <div className="viewer">
    <div className="viewport"><canvas ref={canvas} tabIndex={0} aria-label="Original game model: drag to rotate, scroll to zoom"/>
      {!ready&&!error&&<div className="canvas-note">Loading original textures…</div>}
    </div>
    <div className="controls"><label>Geometry <select disabled={!ready} value={selected} onChange={e=>{setSelected(e.target.value);renderer.current?.select(e.target.value);}}><option value="">All meshes</option>{names.map(n=><option key={n}>{n}</option>)}</select></label>
      <button disabled={!ready} onClick={()=>renderer.current?.fit()}>Fit view</button></div>
    <p className="hint">Drag to orbit · Scroll to zoom · {names.length} meshes. {scene.assembly ? 'Composite rest pose; animation is pending.' : 'Raw geometry; scene transforms and animation are pending.'}</p>
    {error&&<p role="alert" className="error">{error}</p>}
  </div>;
}
