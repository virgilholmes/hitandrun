// Pure3D's chunk header is three 32-bit words: ID, data end, total end.
// Sizes include the 12-byte header and are relative to the chunk start.
export function inspectP3D(buffer) {
  if (!(buffer instanceof ArrayBuffer)) throw new Error('Expected an ArrayBuffer.');
  const view = new DataView(buffer);
  if (view.byteLength < 12) throw new Error('Truncated P3D header.');
  const magic = view.getUint32(0, true);
  if (magic === 0x5a443350 || magic === 0x5033445a)
    throw new Error('Compressed P3D files are not supported yet.');
  if (magic !== 0xff443350 && magic !== 0x503344ff)
    throw new Error('This is not a supported Pure3D file.');
  const little = magic === 0xff443350;
  const counts = new Map();
  const chunks = [];
  const pending = [{ offset: 0, limit: view.byteLength, depth: 0, parent: -1 }];
  while (pending.length) {
    const { offset, limit, depth, parent } = pending.pop();
    if (offset + 12 > limit) throw new Error(`Truncated chunk at ${offset}.`);
    const id = view.getUint32(offset, little);
    const dataLength = view.getUint32(offset + 4, little);
    const totalLength = view.getUint32(offset + 8, little);
    if (dataLength < 12 || totalLength < dataLength || totalLength > limit - offset)
      throw new Error(`Invalid chunk bounds at ${offset}.`);
    if (depth > 128 || chunks.length >= 100000)
      throw new Error('File exceeds inspection limits.');
    if (offset === 0 && totalLength !== view.byteLength)
      throw new Error('Root size does not match file size.');
    const index = chunks.length;
    chunks.push({ id, offset, dataLength, totalLength, depth, parent });
    counts.set(id, (counts.get(id) || 0) + 1);
    // Push the sibling first so the child is visited first, without recursion.
    if (offset !== 0 && offset + totalLength < limit)
      pending.push({ offset: offset + totalLength, limit, depth, parent });
    if (dataLength < totalLength)
      pending.push({ offset: offset + dataLength, limit: offset + totalLength, depth: depth + 1, parent: index });
  }
  return { chunks, counts: [...counts.entries()], littleEndian: little };
}
export const chunkNames = {
  [0xff443350]: 'Pure3D file', [0x00010000]: 'Mesh',
  [0x00010001]: 'Skin', [0x00010002]: 'Primitive group',
  [0x00019000]: 'Texture', [0x00019001]: 'Image', [0x00019002]: 'Image data',
};
export const hex = (id) => '0x' + id.toString(16).padStart(8, '0');
