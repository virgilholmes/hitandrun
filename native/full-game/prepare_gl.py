"""Extend the installed Emscripten GL layer, without changing the installation.
Generated output retains Emscripten's MIT notice. Exact patch anchors fail
closed on incompatible compiler versions instead of silently losing lighting.
"""
from pathlib import Path
import argparse
import hashlib
import json

def prepare(source:Path,destination:Path):
    original=source.read_text();text=original
    def replace(old,new):
        nonlocal text
        if text.count(old)!=1:
            raise ValueError('Unsupported Emscripten GL source anchor: '+old[:100])
        text=text.replace(old,new,1)
    replace('    lightPosition: [],','    lightPosition: [],\n    lightAttenuation: [],')
    anchor='        GLEmulation.lightPosition[lightId] = new Float32Array([0.0, 0.0, 1.0, 0.0]);'
    replace(anchor,anchor+'\n        GLEmulation.lightAttenuation[lightId] = new Float32Array([1, 0, 0]);')
    anchor="                  vsLightingDefs += 'uniform vec4 u_lightPosition' + lightId + ';';"
    replace(anchor,anchor+"\n                  vsLightingDefs += 'uniform vec3 u_lightAttenuation' + lightId + ';';")
    replace("                  vsLightingPass += '    vec3 lightDirection = normalize(u_lightPosition' + lightId + ').xyz;';", """                  vsLightingPass += '    vec3 lightDelta = u_lightPosition' + lightId + '.xyz - ecPosition.xyz * u_lightPosition' + lightId + '.w;';
                  vsLightingPass += '    float lightDistance = length(lightDelta);';
                  vsLightingPass += '    vec3 lightDirection = lightDelta / max(lightDistance, 0.00001);';
                  vsLightingPass += '    float attenuation = u_lightPosition' + lightId + '.w == 0.0 ? 1.0 : 1.0 / max(dot(u_lightAttenuation' + lightId + ', vec3(1.0, lightDistance, lightDistance * lightDistance)), 0.00001);';""")
    replace("                  vsLightingPass += '    v_color.xyz += ambient + diffuse + specular;';", "                  vsLightingPass += '    v_color.xyz += attenuation * (ambient + diffuse + specular);';")
    replace('          this.lightPositionLocation = []','          this.lightPositionLocation = [];\n          this.lightAttenuationLocation = [];')
    anchor="            this.lightPositionLocation[lightId] = GLctx.getUniformLocation(this.program, `u_lightPosition${lightId}`);"
    replace(anchor,anchor+"\n            this.lightAttenuationLocation[lightId] = GLctx.getUniformLocation(this.program, `u_lightAttenuation${lightId}`);")
    anchor='              if (this.lightPositionLocation[lightId]) GLctx.uniform4fv(this.lightPositionLocation[lightId], GLEmulation.lightPosition[lightId]);'
    replace(anchor,anchor+'\n              if (this.lightAttenuationLocation[lightId]) GLctx.uniform3fv(this.lightAttenuationLocation[lightId], GLEmulation.lightAttenuation[lightId]);')
    replace("      } else {\n        abort('glLightfv: TODO: ' + pname);", """      } else if (pname >= 0x1207 && pname <= 0x1209) {
        GLEmulation.lightAttenuation[lightId][pname - 0x1207] = HEAPF32[param >>> 2];
      } else {
        abort('glLightfv: TODO: ' + pname);""")
    replace("    } else if (pname == 0x1601) { // GL_SHININESS", """    } else if (pname == 0x1600) { // GL_EMISSION
      GLEmulation.materialEmission.set(HEAPF32.subarray(param >>> 2, (param >>> 2) + 4));
    } else if (pname == 0x1601) { // GL_SHININESS""")
    # Macro helpers share a compiler VM with the standard GL library.
    text=text.replace('copySigs','hrCopySigs').replace('fromPtr','hrFromPtr')
    destination.parent.mkdir(parents=True,exist_ok=True)
    if not destination.exists() or destination.read_text()!=text:destination.write_text(text)
    destination.with_suffix('.provenance.json').write_text(json.dumps({
        'source':str(source),'originalSha256':hashlib.sha256(original.encode()).hexdigest(),
        'adaptedSha256':hashlib.sha256(text.encode()).hexdigest(),
        'changes':['point/directional lighting with distance attenuation','emissive material color'],
        'license':'MIT; Emscripten notice retained in generated source',
    },indent=2)+'\n')
if __name__=='__main__':
    cli=argparse.ArgumentParser();cli.add_argument('source',type=Path);cli.add_argument('destination',type=Path)
    args=cli.parse_args();prepare(args.source,args.destination)
