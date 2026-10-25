# -*- coding: utf-8 -*-
import json, zlib, struct, math, os

FPS = 50
DUR = 161.31

d = json.load(open('data/analysis.json'))
cues = json.load(open('data/cues.json'))

def rle(a):
    out=[]; prev=None; cnt=0
    for v in a:
        if v==prev: cnt+=1
        else:
            if prev is not None: out.append(cnt)
            prev=v; cnt=1
    out.append(cnt)
    return out

def quant(arr, q=32):
    return [min(q, int(round(v*q))) for v in arr]

bands = {}
for key in ['bass','mid','high','air','rms']:
    arr = d[key][:int(DUR*FPS)]
    if len(arr) < int(DUR*FPS): arr += [0]*(int(DUR*FPS)-len(arr))
    bands[key] = rle(quant(arr))

onsets = [o for o in d['onsets'] if o <= DUR]

# --- PNG writer ---
def write_png(path, w, h, pixels):  # pixels: bytearray RGB
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += pixels[y*w*3:(y+1)*w*3]
    def chunk(t, data):
        c = struct.pack('>I', len(data)) + t + data
        return c + struct.pack('>I', zlib.crc32(t+data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    open(path,'wb').write(png)

def radial(w,h,cx,cy,stops):
    # stops: list of (pos01,(r,g,b))
    px = bytearray(w*h*3)
    maxd = math.hypot(max(cx,w-cx),max(cy,h-cy))
    for y in range(h):
        for x in range(w):
            t = min(1.0, math.hypot(x-cx,y-cy)/maxd)
            for i in range(len(stops)-1):
                p0,c0 = stops[i]; p1,c1 = stops[i+1]
                if p0<=t<=p1:
                    f=(t-p0)/(p1-p0+1e-9)
                    r=int(c0[0]+(c1[0]-c0[0])*f); g=int(c0[1]+(c1[1]-c0[1])*f); b=int(c0[2]+(c1[2]-c0[2])*f)
                    break
            else:
                r,g,b = stops[-1][1]
            j=(y*w+x)*3; px[j]=r; px[j+1]=g; px[j+2]=b
    return px

os.makedirs('assets', exist_ok=True)
# day sky (warm morning village)
write_png('assets/sky_day.png',256,256, radial(256,256,128,60,[(0,(214,236,244)),(0.45,(197,226,240)),(0.75,(244,200,154)),(1.0,(247,214,173))]))
# golden hour (hook sections)
write_png('assets/sky_golden.png',256,256, radial(256,256,128,60,[(0,(255,243,205)),(0.4,(255,229,128)),(0.75,(244,200,154)),(1.0,(247,206,150))]))
# dusk (outro)
write_png('assets/sky_dusk.png',256,256, radial(256,256,128,80,[(0,(244,224,200)),(0.45,(240,208,160)),(0.8,(200,75,49)),(1.0,(166,56,40))]))
# charana fresh green-morning
write_png('assets/sky_green.png',256,256, radial(256,256,128,60,[(0,(216,240,226)),(0.45,(184,232,204)),(0.78,(244,200,154)),(1.0,(247,214,173))]))
print("sky pngs:", [os.path.getsize(f'skills/assets/{f}') if False else os.path.getsize(f'assets/{f}') for f in os.listdir('assets')])

payload = {
  'fps': FPS, 'dur': DUR,
  'bands': bands,
  'onsets': [round(o,3) for o in onsets],
  'cues': cues,
}
json.dump(payload, open('data/timeline.json','w'), ensure_ascii=False, separators=(',',':'))
print("timeline.json bytes:", os.path.getsize('data/timeline.json'))
