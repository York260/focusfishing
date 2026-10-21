import sys,json,base64,zipfile,io,re
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation
def extract(jpath):
    d=json.load(open(jpath)); z=zipfile.ZipFile(io.BytesIO(base64.b64decode(d['content'])))
    doc=z.read('word/document.xml').decode(); rels=z.read('word/_rels/document.xml.rels').decode()
    rmap=dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(media/[^"]+)"',rels))
    return [Image.open(io.BytesIO(z.read('word/'+rmap[r]))).convert('RGB') for r in re.findall(r'r:embed="(rId\d+)"',doc) if r in rmap]
def cut(img):
    im=np.array(img).astype(int)
    white=(im.min(axis=2)>226)&((im.max(axis=2)-im.min(axis=2))<22)
    lab,_=label(white); edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(edge)); a=np.where(bg,0,255).astype(np.uint8)
    ring=binary_dilation(bg,iterations=1)&~bg; lum=im.min(axis=2)
    a[ring]=np.clip((255-lum[ring])*3,60,255).astype(np.uint8)
    out=Image.fromarray(np.dstack([im.astype(np.uint8),a]),'RGBA'); out=out.crop(out.getbbox())
    w,h=out.size; s=int(max(w,h)*1.1); sq=Image.new('RGBA',(s,s),(0,0,0,0)); sq.alpha_composite(out,((s-w)//2,(s-h)//2))
    return sq.resize((512,512),Image.LANCZOS)
if __name__=='__main__':
    imgs=extract(sys.argv[1]); print(len(imgs))
    for spec in sys.argv[2:]:
        i,name=spec.split(':'); cut(imgs[int(i)]).save('/home/claude/focusfishing/desktop/renderer/art/'+name+'.png'); print('saved',name)
