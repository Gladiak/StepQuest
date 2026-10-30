# Read-only raster analysis: emits SVG clip paths, never modifies the PNG.
# Run from the repository root after approving a replacement badge sheet.
import struct,zlib,collections,json
raw=open('renderer/assets/chronicle-badges.png','rb').read();off=8;parts=[]
while off<len(raw):
 size=struct.unpack('>I',raw[off:off+4])[0];typ=raw[off+4:off+8];chunk=raw[off+8:off+8+size];off+=size+12
 if typ==b'IHDR':w,h,depth,color,*_=struct.unpack('>IIBBBBB',chunk)
 if typ==b'IDAT':parts.append(chunk)
data=zlib.decompress(b''.join(parts));stride=w*4;prior=bytearray(stride);alpha=bytearray(w*h)
for y in range(h):
 start=y*(stride+1);f=data[start];row=bytearray(data[start+1:start+1+stride])
 for x in range(stride):
  a=row[x-4] if x>=4 else 0;b=prior[x];c=prior[x-4] if x>=4 else 0
  if f==1:row[x]=(row[x]+a)&255
  elif f==2:row[x]=(row[x]+b)&255
  elif f==3:row[x]=(row[x]+((a+b)//2))&255
  elif f==4:
   p=a+b-c;pa=abs(p-a);pb=abs(p-b);pc=abs(p-c);row[x]=(row[x]+(a if pa<=pb and pa<=pc else b if pb<=pc else c))&255
 alpha[y*w:(y+1)*w]=row[3::4];prior=row

labels=[-1]*(w*h);objects=[]
for pos in range(w*h):
 if labels[pos]!=-1 or alpha[pos]<32:continue
 num=len(objects);q=collections.deque([pos]);labels[pos]=num;pixels=[]
 while q:
  p=q.popleft();pixels.append(p);x=p%w;y=p//w
  for n in (p-1 if x else -1,p+1 if x<w-1 else -1,p-w if y else -1,p+w if y<h-1 else -1):
   if n>=0 and labels[n]==-1 and alpha[n]>=32:labels[n]=num;q.append(n)
 objects.append(pixels)
large=[(i,p) for i,p in enumerate(objects) if len(p)>500]
assert len(large)==24
large.sort(key=lambda o: (round((sum(p//w for p in o[1])/len(o[1])-128)/256),sum(p%w for p in o[1])/len(o[1])))
art=[]
for index,(label,pixels) in enumerate(large):
 # Two source pixels preserve the antialiased edge. Never admit another emblem.
 shape=set(pixels)
 for p in pixels:
  px=p%w;py=p//w
  for dy in range(-2,3):
   for dx in range(-2,3):
    x=px+dx;y=py+dy
    if 0<=x<w and 0<=y<h:
     n=y*w+x
     if alpha[n]>0 and (labels[n]==label or alpha[n]<32):shape.add(n)
 edges={}
 def edge(a,b):edges.setdefault(a,[]).append(b)
 for p in shape:
  x=p%w;y=p//w
  if p-w not in shape:edge((x,y),(x+1,y))
  if p+1 not in shape:edge((x+1,y),(x+1,y+1))
  if p+w not in shape:edge((x+1,y+1),(x,y+1))
  if p-1 not in shape:edge((x,y+1),(x,y))
 loops=[]
 while edges:
  start=next(iter(edges));a=start;loop=[a]
  while True:
   dest=edges[a].pop()
   if not edges[a]:del edges[a]
   a=dest
   if a==start:break
   loop.append(a)
  # Remove collinear vertices, keeping crisp pixel corners.
  compact=[]
  for i,v in enumerate(loop):
   before=loop[i-1];after=loop[(i+1)%len(loop)]
   if (v[0]-before[0])*(after[1]-v[1])!=(v[1]-before[1])*(after[0]-v[0]):compact.append(v)
  if len(compact)>=3:loops.append(compact)
 left=min(p%w for p in shape);right=max(p%w for p in shape)+1;top=min(p//w for p in shape);bottom=max(p//w for p in shape)+1
 path=''.join('M'+' '.join(f'{x},{y}' for x,y in loop)+'Z' for loop in loops)
 art.append({'id':index,'x':left,'y':top,'width':right-left,'height':bottom-top,'corePixels':len(pixels),'path':path})
print([(a['id'],a['x'],a['y'],a['width'],a['height'],len(a['path'])) for a in art])
open('renderer/chronicle-art.js','w').write("'use strict';\n// Vector clipping paths measured from the original transparent artwork.\nwindow.StepQuestChronicleArt="+json.dumps({'width':w,'height':h,'sourceSha256':__import__('hashlib').sha256(raw).hexdigest(),'badges':art},separators=(',',':'))+';\n')
