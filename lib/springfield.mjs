// Region set and house coordinates from the original level01 mission scripts.
export const SPRINGFIELD={
 resources:'art/L1_TERRA.p3d',
 regions:['art/l1z1.p3d','art/l1r1.p3d','art/l1r7.p3d'],
 house:[220,3.5,-172],
};
export function mergeArea(resources,regions){
 const shaders=new Map(resources.shaders),textures=new Map(resources.textures);
 const groups=[],warnings=new Set(resources.warnings);
 for(const scene of regions){
  for(const [name,shader] of scene.shaders)shaders.set(name,shader);
  for(const [name,texture] of scene.textures)textures.set(name,texture);
  groups.push(...scene.groups);
  for(const warning of scene.warnings)warnings.add(warning);
 }
 const missingTextures=[...new Set(groups.map(g=>shaders.get(g.shader)?.texture).filter(name=>name&&!textures.has(name)))];
 return {groups,shaders,textures,warnings:[...warnings],missingTextures,assembly:null};
}
