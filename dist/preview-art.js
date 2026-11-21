'use strict';

// Polar cell boundaries fit together on a continuous epithelial section.
function paintEpithelialSection(g,cavity,collapse,solid) {
  const tau = Math.PI * 2;
  const mix = (a,b,t) => a+(b-a)*t;
  const n=34, centerX=-.035, centerY=-.018;
  const outer=(a)=>.94+.035*Math.sin(3*a+.7)+.026*Math.cos(5*a-.4)+.014*Math.sin(9*a);
  const radius=(.18+.43*cavity)*(1-.96*solid);
  function point(a,level) {
    const c=Math.cos(a),s=Math.sin(a),base=outer(a);
    const fold=1+.068*Math.sin(a*5+.7)+.04*Math.cos(a*3);
    const x=centerX+c*radius*fold*(1+collapse*.28), y=centerY+s*radius*fold*(1-collapse*.81)+collapse*.08*Math.sin(3*c);
    return [mix(x,c*base,level),mix(y,s*base*(1-collapse*.17),level)];
  }
  const pathRing=(level)=>{const path=new Path2D();for(let j=0;j<136;j++){const [x,y]=point(tau*j/136,level);if(j)path.lineTo(x,y);else path.moveTo(x,y);}path.closePath();return path;};
  g.fillStyle='#cfe8ee';g.fill(pathRing(1));g.lineJoin='round';
  const bands=[0,.68,.95,1];
  for(let b=0;b<3;b++){
    const count=b===1?48:n, offset=b*.32;
    for(let i=0;i<count;i++){
      const aa=tau*(i+offset)/count, bb=aa+tau/count, pert=.025*Math.sin(i*9.6+b);
      const a=point(aa+pert,bands[b]), z=point(bb+.025*Math.sin((i+1)*9.6+b),bands[b]);
      const c=point(aa,bands[b+1]), d=point(bb,bands[b+1]), mid=point((aa+bb)/2,bands[b+1]);
      const path=new Path2D();path.moveTo(...a);path.quadraticCurveTo(...point((aa+bb)/2,bands[b]-.012),...z);
      path.quadraticCurveTo(...point(bb+.017,(bands[b]+bands[b+1])/2),...d);path.quadraticCurveTo(...mid,...c);
      path.quadraticCurveTo(...point(aa+.017,(bands[b]+bands[b+1])/2),...a);path.closePath();
      const tone=3*Math.sin(i*5.13+b)+2*Math.cos(i*.45);
      g.fillStyle=b===0?'hsl(187,44%,'+(81+tone)+'%)':b===1?'hsl(178,34%,'+(84+tone)+'%)':'#99cbd0';
      g.fill(path);g.strokeStyle='#427b8e9c';g.lineWidth=b===0?.006:.004;g.stroke(path);
      if(b===2)continue;
      const ang=(aa+bb)/2, [nx,ny]=point(ang,b===0?.42:.81);
      g.save();g.translate(nx,ny);g.rotate(ang+.2*Math.sin(i));g.beginPath();g.ellipse(0,0,b===0?.045:.023,b===0?.023:.013,0,0,tau);
      g.fillStyle=b===0?'#508897':'#75a1a8';g.fill();g.beginPath();g.ellipse(.01,-.003,.009,.006,0,0,tau);g.fillStyle='#326371';g.fill();g.restore();
      if(b===0)for(let j=1;j<=3;j++){
        const a0=aa+(bb-aa)*j/4;
        g.beginPath();g.moveTo(...point(a0,.05));g.quadraticCurveTo(...point(a0+.014,.18),...point(a0,.29));
        g.strokeStyle='#eaf8fa';g.lineWidth=.004;g.stroke();
      }
    }
  }
  const lumen=pathRing(0);
  g.fillStyle='#234569';g.fill(lumen);g.strokeStyle='#efffff';g.lineWidth=.025;g.stroke(lumen);
  g.strokeStyle='#548894';g.lineWidth=.009;g.stroke(pathRing(1));
  if(solid>.1){g.globalAlpha=solid;for(let i=0;i<15;i++){const a=i*2.4,r=.22*Math.sqrt(i/15);g.beginPath();g.ellipse(Math.cos(a)*r,Math.sin(a)*r,.044,.028,a,0,tau);g.fillStyle='#86b6bc';g.fill();}g.globalAlpha=1;}
}

// The two editions share composition, timing and manuscript references.
// Only the specimens, slicing plane and projection change with the medium.
function createPreviewArt(canvas, invalidate, translate) {
  const ctx = canvas.getContext('2d');
  const ink = '#202841', muted = '#52657b', red = '#465da7', teal = '#1f8184';
  const blue = '#6f7fa6', paper = '#f7f9fc', faint = '#c4cfdd';
  const colors = [teal, '#bc603f', blue], tau = Math.PI * 2;
  const clamp = x => Math.min(1, Math.max(0,x));
  const mix = (a,b,t) => a+(b-a)*t;
  const phase = (p,a,b) => {const t=clamp((p-a)/(b-a));return t*t*(3-2*t);};
  const between = (a,b,t) => [mix(a[0],b[0],t),mix(a[1],b[1],t)];
  const prefixes = ['colon-budding-transparent','stomach-hollow','lung-lumen','colon-budding-opaque','stomach-solid','lung-non-lumen'];
  const fates = Object.keys(study.dynamic.fates);
  const images = new Map(), tiles = new Map();
  let mesh, cameraX=0, cameraY=0, spatial=false, w=0, h=0, compact=false;
  const mask = document.createElement('canvas');
  function image(file) {
    if (!images.has(file)) {
      const im=new Image(); im.onload=invalidate; im.src='assets/'+file+'.png'; images.set(file,im);
    }
    const im=images.get(file); return im.complete && im.naturalWidth ? im : null;
  }
  function dot(x,y,r,fill,stroke,weight=1) {
    ctx.beginPath(); ctx.arc(x,y,Math.max(.01,r),0,tau);
    if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=weight;ctx.stroke();}
  }
  function line(path,color= faint,weight=1,dash=[]) {
    ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.setLineDash(dash);ctx.stroke(new Path2D(path));ctx.setLineDash([]);
  }
  function text(str,x,y,size=13,color=muted,align='center',bold=false,mono=false) {
    ctx.font=(bold?'650 ':'450 ')+size+'px '+(mono?"Consolas,monospace":"'Segoe UI','Microsoft YaHei',sans-serif");
    ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(str,x,y);
  }
  function layer(alpha,draw) {
    if(alpha<=.001)return;
    ctx.save();ctx.globalAlpha*=clamp(alpha);draw();ctx.restore();
  }
  function brackets(x,y,ww,hh,color=red) {
    const k=Math.min(ww*.18,9);
    for(const [a,b,sx,sy] of [[x,y,1,1],[x+ww,y,-1,1],[x,y+hh,1,-1],[x+ww,y+hh,-1,-1]])
      line('M'+(a+sx*k)+' '+b+'H'+a+'v'+sy*k,color,1.3);
  }
  function cross(x,y,size=5) {line('M'+(x-size)+' '+y+'h'+size*2+'M'+x+' '+(y-size)+'v'+size*2,'#8295ad',.75);}
  function drawCrop(file,x,y,size) {
    const im=image(file);
    ctx.fillStyle='#d2dae2';ctx.fillRect(x,y,size,size);
    if(im)ctx.drawImage(im,x,y,size,size);
  }

  function specimen(x,y,r,opts={}) {
    if(r<1)return;
    const {cavity=.75,collapse=0,solid=0,opening=1,yaw=.81,pitch=.48}=opts;
    const quant=(v,n)=>Math.round(v*n)/n;
    const c=quant(cavity,25),k=quant(collapse,22),s=quant(solid,22),o=quant(opening,24);
    const a=quant(yaw+cameraX,42),b=quant(pitch+cameraY,42);
    const res=r>165?220:r>103?152:r>58?96:54;
    const key=spatial?[1,res,c,k,s,o,a,b].join('/'):[0,res,c,k,s].join('/');
    let tile=tiles.get(key);
    if(!tile) {
      tile=document.createElement('canvas');tile.width=tile.height=Math.ceil(res*2.8);
      const g=tile.getContext('2d'), mid=tile.width/2;
      if(spatial) {
        if(!mesh)mesh=createOrganoidStructure(()=>{tiles.clear();invalidate();},64);
        const hollow=c*(1-s);
        mesh.draw(g,{x:mid,y:mid,radius:res,weights:[1-hollow,0,hollow*(1-k),hollow*k],opening:o,yaw:a,pitch:b,detail:1,form:2});
      }else{
        g.translate(mid,mid);g.scale(res,res);paintEpithelialSection(g,c,k,s);
      }
      if(tiles.size>=42)tiles.delete(tiles.keys().next().value);
      tiles.set(key,tile);
    }
    const size=r*tile.width/res;ctx.drawImage(tile,x-size/2,y-size/2,size,size);
  }
  function guides(x,y,r) {
    ctx.save();ctx.setLineDash([2,6]);dot(x,y,r,null,'#9caec5',.85);ctx.restore();
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])cross(x+Math.cos(a)*r,y+Math.sin(a)*r,3.2);
  }
  function hero(p,age) {
    const zoom=phase(p,.32,.82), cut=phase(p,.82,1), portal=phase(p,.30,.47);
    const size=compact?Math.min(w*.274,h*.22):Math.min(w*.117,h*.26);
    const fs=size, font='750 '+fs+'px "Segoe UI",Arial,sans-serif';
    const base=h*(compact?.61:.432), mid=h*(compact?.314:.50);
    ctx.font=font; const chars=[...'V3Cell'], widths=chars.map(c=>ctx.measureText(c).width), spacing=-fs*.072;
    const total=widths.reduce((a,b)=>a+b,0)+spacing*5, xs=[];
    let x=compact?(w-total)/2:w*.05-fs*.025;
    for(const dw of widths){xs.push(x);x+=dw+spacing;}
    const cx=mix(compact?w*.50:w*.735,w*.5,zoom),cy=mix(mid,h*.52,zoom);
    const rr=mix(compact?Math.min(h*.191,w*.27):Math.min(h*.327,w*.167),Math.min(h*.365,w*.345),zoom);
    const reveal=phase(age,.12,.83);
    layer((1-reveal)*(1-portal),()=>{
      const side=rr*1.6;ctx.save();ctx.translate(cx,cy);ctx.scale(1,.7+.3*reveal);
      drawCrop('stomach-hollow-real-1',-side/2,-side/2,side);ctx.restore();
    });
    layer(reveal*(1-zoom),()=>{
      guides(cx,cy,rr*1.19);
      ctx.save();ctx.strokeStyle='#a7bad186';ctx.lineWidth=.8;
      ctx.translate(cx,cy);ctx.rotate(-.34);ctx.beginPath();ctx.ellipse(0,0,rr*1.35,rr*.84,0,0,tau);ctx.stroke();ctx.restore();
      if(!compact){
        const gy=cy+rr*1.12;
        const shade=ctx.createRadialGradient(cx,gy,0,cx,gy,rr*.86);
        shade.addColorStop(0,'#7d91bf50');shade.addColorStop(1,'#8ca2cb00');
        ctx.save();ctx.translate(0,gy*.8);ctx.scale(1,.2);ctx.fillStyle=shade;ctx.fillRect(cx-rr,gy-rr,2*rr,2*rr);ctx.restore();
      }
    });
    layer(reveal,()=>{
      ctx.save();ctx.translate(cx,cy);ctx.scale(1,mix(.53,1,reveal));
      specimen(0,0,rr,{cavity:.94,opening:mix(.86,1,cut),yaw:.61+.20*zoom,pitch:.39+.09*zoom});ctx.restore();
    });
    if(!compact && portal>0 && zoom<.999) {
      // Draw a paper matte with a genuine glyph-shaped aperture, then fly through the C stroke.
      const m=mask.getContext('2d'), ratio=canvas.width/w;
      if(mask.width!==canvas.width||mask.height!==canvas.height){mask.width=canvas.width;mask.height=canvas.height;}
      m.setTransform(ratio,0,0,ratio,0,0);m.clearRect(0,0,w,h);m.fillStyle=paper;m.fillRect(0,0,w,h);
      m.save();m.globalCompositeOperation='destination-out';
      const px=xs[2]+widths[2]*.11,py=base-fs*.35, scale=Math.exp(Math.log(82)*zoom);
      m.translate(mix(px,w*.5,zoom),mix(py,h*.5,zoom));m.scale(scale,scale);m.translate(-px,-py);
      m.fillStyle='#000';m.font=font;m.textAlign='left';chars.forEach((c,i)=>m.fillText(c,xs[i],base));m.restore();
      layer(portal*(1-phase(zoom,.85,1)),()=>{
        ctx.fillStyle='#d4e1f2';ctx.fillRect(0,0,w,h);
        specimen(mix(px,w*.5,zoom),mix(py,h*.52,zoom),rr,{cavity:.94,opening:.86,yaw:.61+.20*zoom,pitch:.39+.09*zoom});
        ctx.drawImage(mask,0,0,w,h);
      });
    }
    layer(1-portal,()=>{ctx.font=font;ctx.textAlign='left';ctx.fillStyle=ink;
      chars.forEach((c,i)=>{const q=phase(age,.035*i,.035*i+.53);layer(q,()=>ctx.fillText(c,xs[i],base+(1-q)*fs*.4));});
    });
    layer(cut,()=>slicePlane(w/2,h*.51,rr*1.07,cut));
  }
  function plateSection(p) {
    const cx=w*.5,cy=h*.49,r=Math.min(w*.259,h*.328);
    const lift=phase(p,.04,.31), sweep=phase(p,.38,.79);
    ctx.save();ctx.globalAlpha=.65;guides(cx,cy,r*1.28);ctx.restore();
    layer(1-lift,()=>{const side=r*1.64;drawCrop('stomach-hollow-real-1',cx-side/2,cy-side/2,side);});
    layer(lift,()=>{
      specimen(cx,cy,r*(.83+.17*lift),{cavity:.55+.4*sweep});
      const windowIn=phase(p,.27,.38),windowOut=phase(p,.49,.61);
      if(windowIn>0 && windowOut<1) {
        const m=mask.getContext('2d'), ratio=canvas.width/w;
        if(mask.width!==canvas.width||mask.height!==canvas.height){mask.width=canvas.width;mask.height=canvas.height;}
        m.setTransform(ratio,0,0,ratio,0,0);m.clearRect(0,0,w,h);
        m.fillStyle='#e8f3ef';m.fillRect(0,0,w,h);
        const fs=Math.min(w*.31,h*.5),base=cy+.34*fs;
        m.font='800 '+fs+'px "Segoe UI",sans-serif';m.textAlign='left';
        const word='V3Cell',x=cx-m.measureText(word).width/2,ax=x+m.measureText('V3').width+.13*fs;
        const t=phase(p,.37,.60),scale=Math.exp(Math.log(32)*t);
        m.save();m.globalCompositeOperation='destination-out';m.translate(mix(ax,cx,t),cy);m.scale(scale,scale);m.translate(-ax,-cy);
        m.fillText(word,x,base);m.restore();
        layer(windowIn*(1-windowOut),()=>ctx.drawImage(mask,0,0,w,h));
      }
      const a=phase(p,.58,.69); 
      layer(a*(1-phase(p,.83,1)),()=>{
        const y=cy+r*(1-2*sweep);
        line('M'+(cx-r*1.38)+' '+y+'h'+r*2.76,'#277e88',1.3);
        cross(cx+r*1.38,y);
      });
      layer(phase(p,.69,.91),()=>{
        const x=cx+r*.67,y=cy-r*.54, right=Math.min(w-10,cx+r*1.58);
        line('M'+x+' '+y+'l'+r*.17+' '+(-r*.28)+'H'+right,teal,1);
        text(translate('上皮层','Epithelium'),right,y-r*.34,compact?12:14,teal,'right',true);
        line('M'+(cx-r*.1)+' '+(cy+r*.06)+'l'+(-r*.9)+' '+r*.58+'h'+(-r*.37),teal,1);
        text(translate('腔隙','Lumen'),cx-r*1.37,cy+r*.81,compact?12:14,teal,'left',true);
      });
    });
  }
  function slicePlane(x,y,r,amount) {
    const yy=y-r*(1-amount);
    if(spatial){
      const skew=r*(.43+.09*Math.sin(cameraX)),d=r*.2;
      const path=new Path2D('M'+(x-r-skew)+' '+(yy+d)+'l'+2*r+' 0 '+skew*2+' '+(-d*2)+'h'+(-2*r)+'Z');
      ctx.fillStyle='#75ccde3a';ctx.fill(path);ctx.strokeStyle='#4795ad';ctx.lineWidth=1;ctx.stroke(path);
    }else line('M'+(x-r*1.27)+' '+yy+'h'+(r*2.54),red,1.4);
    cross(x-r*1.24,yy);cross(x+r*1.24,yy);
  }
  const scatter=Array.from({length:108},(_,i)=>{
    const lin=i%3,sub=Math.floor(i/6)%[4,3,2][lin],kind=Math.floor(i/3)%2;
    const angle=sub/[4,3,2][lin]*tau+lin, a=i*2.39996,r=5+15*((i*17)%41)/41;
    return {lin,kind,tile:lin+3*(Math.floor(i/6)%2),x:27*Math.cos(angle)+Math.cos(a)*r,y:20*Math.sin(angle)+Math.sin(a)*r,z:Math.sin(i*3.86)*20};
  });
  function atlas(p) {
    const phone=compact,W=phone?360:960,H=phone?350:354;
    const C=phone?[180,92]:[480,159], left=phone?[85,231]:[208,164],right=phone?[275,231]:[752,164];
    const start=phase(p,.03,.13),real=phase(p,.15,.32),virt=phase(p,.35,.58),cloud=phase(p,.59,.79),loop=phase(p,.83,.96);
    const radius=mix(phone?72:116,phone?44:72,real), side=phone?33:48;
    const group=(which)=>which?right:left;
    const tilePos=(which,i)=>{const g=group(which);return [g[0]+((i%3)-1)*(side+4),g[1]+(Math.floor(i/3)-.5)*(side+4)];};
    const clusterCenters=phone?[[83,109],[273,109],[180,235]]:[[241,149],[480,149],[719,149]];
    layer(1-cloud,()=>{
      layer(.9,()=>guides(...C,radius*1.14));
      specimen(...C,radius,{cavity:.94,opening:start});
      layer(1-real,()=>{slicePlane(...C,radius,start);brackets(C[0]-radius*.63,C[1]-radius*.64,radius*1.26,radius*1.28);
        text('64 × 64 ROI',C[0],C[1]+radius*(phone?1.32:1.25),phone?13:15,red,'center',true,true);});
      [real,virt].forEach((amount,kind)=>layer(amount,()=>{
        const g=group(kind),dir=kind?1:-1,col=kind?red:teal;
        const sx=C[0]+(phone?dir*27:dir*radius*.94),sy=C[1]+(phone?radius*.8:0);
        const ex=phone?g[0]:g[0]-dir*(side*1.62+5),ey=phone?g[1]-side*1.12-19:g[1];
        line('M'+sx+' '+sy+'C'+mix(sx,ex,.52)+' '+sy+' '+mix(sx,ex,.45)+' '+ey+' '+ex+' '+ey,col,1.4,[4,4]);
        for(let i=0;i<6;i++){
          const [tx,ty]=tilePos(kind,i), frac=phase(amount,0+i*.042,.77+i*.042);
          const file=prefixes[i]+'-'+(kind?'virtual':'real')+'-1';
          if(kind && frac<1){for(let n=0;n<49;n++){const v=130+((n*73+i*91)%92);ctx.fillStyle='rgb('+v+','+v+','+v+')';ctx.fillRect(tx-side/2+(n%7)*side/7,ty-side/2+Math.floor(n/7)*side/7,side/7+.4,side/7+.4);}}
          ctx.save();ctx.beginPath();ctx.rect(tx-side/2,ty-side/2,side,side*frac);ctx.clip();drawCrop(file,tx-side/2,ty-side/2,side);ctx.restore();
        }
        text(kind?'R3GAN':translate('明场成像','Microscopy'),g[0],g[1]-side-11,phone?13:16,col,'center',true);
        text(kind?translate('虚拟 ROI','Virtual ROIs'):translate('真实 ROI','Real ROIs'),g[0],g[1]+side+21,phone?12:14,ink);
      }));
    });
    const loopCenter=[W/2,phone?155:160], ring=phone?85:111;
    layer(phase(p,.57,.64)*(1-loop),()=>{
      for(const d of scatter){
        const g=clusterCenters[d.lin], start=tilePos(d.kind,d.tile);
        const par=spatial?Math.sin(cameraX+.32)*d.z:0;
        let [x,y]=between(start,[g[0]+d.x+par,g[1]+d.y+(spatial?Math.sin(cameraY+.19)*d.z:0)],cloud);
        [x,y]=between([x,y],loopCenter,loop);
        dot(x,y,phone?3.1:3.7,d.kind?paper:colors[d.lin],colors[d.lin],1.45);
      }
      layer(cloud,()=>{
        clusterCenters.forEach(([x,y],i)=>{
          const id=['colon','stomach','lung'][i];text(translate(['结肠','胃','肺'][i],['Colon','Stomach','Lung'][i])+' · '+study.static.lineages[id].classes,x,y-48,phone?13:16,colors[i],'center',true);
          text('F1 '+study.phenotyping.scores[id].virtual.toFixed(2),x,y+53,phone?12:14,ink,'center',false,true);
        });
        text(translate('● 真实　○ 虚拟　 /　 表型分布示意','● Real   ○ Virtual   /   Schematic embedding'),W/2,H-7,phone?11:13,muted);
      });
    });
    layer(loop,()=>{
      ctx.save();ctx.translate(...loopCenter);
      if(spatial){ctx.rotate(-.14+cameraX*.08);ctx.scale(1.28,.77+.12*Math.cos(cameraY));}
      [teal,red].forEach((col,i)=>{ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.arc(0,0,ring,Math.PI*(.5+i),Math.PI*(.5+i+loop));ctx.stroke();dot(0,(i?-1:1)*ring,3,col);});ctx.restore();
      specimen(...loopCenter,phone?56:75,{cavity:.86});
      const spread=ring*(spatial?1.36:1.14);
      text(translate('观测','Observed'),loopCenter[0]-spread,loopCenter[1]+(phone?ring+20:2),phone?12:15,teal,phone?'center':'right',true);
      text(translate('生成','Generated'),loopCenter[0]+spread,loopCenter[1]+(phone?ring+20:2),phone?12:15,red,phone?'center':'left',true);
    });
  }

  function morphology(i,t) {
    if(i===0)return {cavity:.34+.64*t,collapse:0,solid:0};
    if(i===1)return {cavity:.34+.59*phase(t,0,.46),collapse:phase(t,.46,1),solid:0};
    return {cavity:.34,collapse:0,solid:t};
  }
  function fate(p) {
    const phone=compact,W=phone?360:960,H=phone?350:354;
    const origin=phone?[61,130]:[165,149], laneX=phone?156:445, ys=phone?[58,144,229]:[59,156,252];
    const begin=phase(p,0,.14), split=phase(p,.245,.35),run=clamp((p-.35)/.48),end=phase(p,.85,.98);
    const frame=p<=.15?Math.round(mix(1,6,begin)):6+Math.round(19*run);
    const r=phone?29:45,originR=phone?40:68;
    const names=[translate('腔体形成','Formation'),translate('腔体塌陷','Collapse'),translate('未形成腔体','Non-cavity')];
    const centerX=mix(W*.5,origin[0],phase(p,.145,.31));
    const centerY=mix(phone?132:151,origin[1],split);
    guides(centerX,centerY,originR*1.15);
    layer(1-.7*split,()=>specimen(centerX,centerY,originR,{cavity:.10+.24*begin}));
    layer(1-split,()=>text(translate('羊膜囊类器官','Amniotic-sac organoid'),centerX,centerY+originR+24,phone?12:15,muted));
    const hit=phase(p,.15,.222), ripple=phase(p,.202,.29);
    layer(Math.sin(hit*Math.PI),()=>{
      const yy=centerY-originR-65+hit*61;ctx.fillStyle=red;const x=centerX;
      ctx.fill(new Path2D('M'+x+' '+(yy-9)+'q-12 16 0 16q12 0 0 -16Z'));
    });
    layer(Math.sin(ripple*Math.PI)*.9,()=>dot(centerX,centerY,originR*(1.04+ripple*.5),null,red,1.5));
    layer(phase(p,.17,.21)*(1-split),()=>{
      const x=phone?206:557, y=phone?64:78;
      text(translate('第 5 帧 · 命运判别','Frame 5 · Fate cues'),x,y-12,phone?12:15,red,'left',true);
      for(let i=0;i<3;i++){
        const yy=y+12+i*(phone?20:26);
        line('M'+x+' '+yy+'h'+(phone?68:126),faint,1.2);
        line('M'+x+' '+yy+'h'+((phone?68:126)*phase(p,.166+i*.01,.225+i*.008)),colors[i],2.5);
      }
    });
    layer(split,()=>{
      const fromX=origin[0]+originR, px=phone?195:525, ex=phone?313:819;
      for(let i=0;i<3;i++){
        const y=ys[i], color=colors[i], st=morphology(i,run);
        line('M'+fromX+' '+origin[1]+'C'+mix(fromX,laneX,.53)+' '+origin[1]+' '+mix(fromX,laneX,.4)+' '+y+' '+(laneX-r*.6)+' '+y,color,1.3);
        const [lx,ly]=between(origin,[laneX,y],split);
        if(run>0 && split>=1){
          for(const lag of [.24,.12]) {
            if(run<lag)continue;
            layer(.13,()=>specimen(lx-r*lag,ly,r*(1+.11*(run-lag)),morphology(i,run-lag)));
          }
        }
        specimen(lx,ly,r*(1+.11*run),st);
        text(names[i],px,y-(phone?13:20),phone?12:16,color,'left',true);
        const by=y+(phone?17:23), amp=phone?24:39;
        line('M'+px+' '+by+'H'+ex,faint,1);
        let d='',last=by;
        const n=Math.max(1,Math.ceil(run*60));
        for(let j=0;j<=n;j++){const q=run*j/n, shape=morphology(i,q),area=(shape.cavity*(1-shape.solid))**2*(1-.92*shape.collapse);last=by-area*amp;d+=(j?'L':'M')+mix(px,ex,q)+' '+last;}
        line(d,color,1.8);dot(mix(px,ex,run),last,2.7,color);
        layer(end,()=>{const size=phone?28:46;drawCrop('trajectory-'+fates[i]+'-6',ex+(phone?7:18),y-size*.5,size);
          const correlation=study.dynamic.fates[fates[i]].probability.toFixed(3);
          text('r = '+correlation,px,y+(phone?30:41),phone?9:11,ink,'left',false,true);});
      }
    });
    const x1=phone?10:91,x2=W-x1, yy=H-(phone?31:26), spacing=(x2-x1)/24;
    line('M'+x1+' '+yy+'H'+x2,faint,1);
    for(let i=0;i<25;i++){
      const x=x1+i*spacing,lit=i<frame;
      if(i<6){const size=phone?9:15;ctx.fillStyle=lit?'#aac1da':'#e0e8ed';ctx.fillRect(x-size/2,yy-size/2,size,size);
        if(i===4&&p>.15&&p<.35)brackets(x-size/2-2,yy-size/2-2,size+4,size+4);}
      else dot(x,yy,phone?2.1:3,lit?red:paper,lit?red:faint);
    }
    const cursor=x1+(frame-1)*spacing;line('M'+cursor+' '+(yy-13)+'v-5',red,2);
    text(translate('输入 6 帧','6 input frames'),x1,yy+22,phone?10:12,muted,'left');
    text(translate('推演 19 帧','19 rollout frames'),x2,yy+22,phone?10:12,muted,'right');
    text(String(frame).padStart(2,'0')+' / 25',W/2,yy+22,phone?10:12,red,'center',true,true);
  }

  function draw(act,progress,mode,age=1,opacity=1,clear=true) {
    const box=canvas.getBoundingClientRect();
    w=box.width;h=box.height;if(!w||!h)return;
    const ratio=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){
      canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
    }
    compact=mode==='3d'?w<=700:w<570;spatial=mode==='3d';
    ctx.setTransform(ratio,0,0,ratio,0,0);if(clear)ctx.clearRect(0,0,w,h);
    ctx.save();ctx.globalAlpha=opacity;
    if(act===0 && spatial)hero(progress,age);
    else if(act===0)plateSection(progress);
    else{
      const bw=compact?360:960,bh=compact?350:354;
      const top=spatial?(compact?101:Math.max(120,h*.22)):8, bottom=spatial?(compact?27:40):8;
      const scale=Math.min((w-(compact?12:28))/bw,(h-top-bottom)/bh);
      ctx.translate((w-bw*scale)/2,top+(h-top-bottom-bh*scale)/2);ctx.scale(scale,scale);
      if(act===1)atlas(progress);else fate(progress);
    }
    ctx.restore();
  }
  function orbit(dx,dy){cameraX=Math.max(-1.35,Math.min(1.35,cameraX+dx));cameraY=Math.max(-.78,Math.min(.78,cameraY+dy));invalidate();}
  return {draw,orbit,reset(){cameraX=0;cameraY=0;invalidate();}};
}

