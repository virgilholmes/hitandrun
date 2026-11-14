"use client";
import { useState } from 'react';
import { chunkNames, hex } from '../../lib/p3d.mjs';
import { readScene } from '../../lib/scene.mjs';
import AssetViewer from '../asset-viewer';
const MAX_BYTES = 64 * 1024 * 1024;
export default function Page() {
  const [result, setResult] = useState(null);
  const [scene, setScene] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function open(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(''); setResult(null); setScene(null); setName(file.name);
    try {
      if (file.size > MAX_BYTES) throw new Error('Choose a P3D file under 64 MiB.');
      const decoded=readScene(await file.arrayBuffer());
      setResult(decoded.inspection); setScene(decoded);
    } catch (e) { setError(e.message || 'Could not read file.'); }
    finally { setBusy(false); }
  }
  return <main>
    <header><span className="tag">BROWSER PORT / FIRST MILESTONE</span><h1>The Simpsons<br/><em>Hit & Run</em></h1>
      <p>Original assets. A new platform.</p></header>
    <section className="status"><span className="dot"/><div><strong>Engine port pending</strong><p>Original meshes and PNG textures can render here. Gameplay is not implemented.</p></div></section>
    <section><h2>Render an original game asset</h2><p>Choose a .p3d file from your PC game's art folder. Files are read locally in your browser.</p>
      <label className="picker">{busy ? 'Reading…' : 'Choose a P3D file'}<input type="file" accept=".p3d" disabled={busy} onChange={open}/></label>
      <p className="hint">Try game/cd/PC/art/cars/famil_v.p3d (the family car)</p>
      <div role="status" aria-live="polite">{error && <p className="error">{error}</p>}{result && <>
        <h3>{name}</h3>
        {scene.groups.length > 0 ? <AssetViewer scene={scene}/> : <p>No supported geometry in this file. The chunk table is available below.</p>}
        {scene.warnings.map(w=><p className="hint" key={w}>{w}</p>)}<p>{result.chunks.length.toLocaleString()} chunks · {result.littleEndian ? 'Little' : 'Big'} endian</p>
        <div className="table"><table><thead><tr><th>Chunk type</th><th>ID</th><th>Count</th></tr></thead><tbody>{result.counts.map(([id,count]) => <tr key={id}><td>{chunkNames[id] || 'Other game data'}</td><td><code>{hex(id)}</code></td><td>{count}</td></tr>)}</tbody></table></div>
      </>}</div>
    </section>
    <footer>Next.js hosts the interface. The original C++ engine still needs a WebAssembly port.</footer>
  </main>;
}
