'use strict';

// One closed, textured surface per form. Opening a longitude sector exposes the
// inner wall and the two cut faces. All pigments and geometry are illustrative.
function createOrganoidStructure(onMaterialReady, longitudes = 104) {
  const latitudes = longitudes/2;
  const tau = 2*Math.PI, seam = .115;
  const shell = [], lumen = [], walls = [[],[]];
  // A shallow bevel at either edge lets the cut catch light as the model turns.
  const wallBands = [0,.035,.09,.20,.50,.80,.91,.965,1];
  const skin = 0, cavity = 1, tissue = 2;
  let lastWeights = [], lastDetail = -1;
  const renderer = createTissuePainter(() => { lastWeights=[]; onMaterialReady(); });

  // Lobes join the same surface as the body, including at their necks.
  const buds = [
    [-.86,.48,.17,.46,.091], [.62,.66,-.43,.41,.106], [.52,-.72,.45,.28,.076]
  ].map(([x,y,z,length,width]) => {
    const norm = Math.hypot(x,y,z);
    return {x:x/norm,y:y/norm,z:z/norm,length,width};
  });

  function position(form, phi, theta, inside) {
    const sl = Math.sin(phi);
    const x = sl*Math.sin(theta), y = Math.cos(phi), z = sl*Math.cos(theta);
    const folds = .048*Math.sin(3.8*x+2*y-2.2*z)*Math.cos(3.4*y-2*z)
                + .023*Math.cos(6*x-2.8*y+3.7*z) + .012*Math.sin(9*x+3*y)*Math.cos(7*y-4*z);
    if (inside) {
      if (form<2) return [0,y*(form===0?.96+.43*folds:.78+.6*folds),0];
      if (form===3) {
        const drape=.115*Math.sin(3.9*x+.7*z)+.039*Math.sin(4.4*z-1.5*x);
        const clearance=.054+.078*(.5+.5*Math.cos(4.2*x-1.7*z));
        return [.84*x, drape+y*clearance, .56*z];
      }
      const flow=10*x+6*y-8*z+1.8*Math.sin(5*z+2*x)+.75*Math.sin(7*y-3*x);
      const ripple=.024*Math.cos(flow)*(.6+.35*Math.sin(4*y-5*z));
      const radius = .785+.72*folds+ripple;
      return [x*radius, y*(radius-.023), z*(radius-.036)];
    }
    if (form===1) {
      const radius=.78+.6*folds;
      let px=x*radius, py=y*radius, pz=z*radius;
      for (const bud of buds) {
        const radial=x*bud.x+y*bud.y+z*bud.z;
        const distance=(1-radial)/bud.width;
        if (distance>3) continue;
        const dome=Math.exp(-1.55*distance*distance);
        const lift=bud.length*dome, flare=.26*dome;
        px+=lift*bud.x+flare*(x-radial*bud.x);
        py+=lift*bud.y+flare*(y-radial*bud.y);
        pz+=lift*bud.z+flare*(z-radial*bud.z);
      }
      return [px,py,pz];
    }
    if (form===3) {
      const drape=.115*Math.sin(3.9*x+.7*z)+.039*Math.sin(4.4*z-1.5*x);
      const furrow=.086*Math.exp(-((2.9*x-1.1*z+.24)**2));
      return [x*(1.08+folds), y*(.59+folds-furrow)+drape, z*(.74+folds)];
    }
    const radius = 1+folds*(form===0?.43:1);
    return [x*radius,y*(radius-.04),z*(radius-.07)];
  }

  function surfaceVertex(phi,theta,inside,u,v) {
    const poses = [];
    for (let form=0;form<4;form++) {
      const p = position(form,phi,theta,inside);
      // Sample slightly in from each pole so the longitudinal tangent exists.
      const lat = Math.max(.005,Math.min(Math.PI-.005,phi));
      const north = position(form,lat-.002,theta,inside), south = position(form,lat+.002,theta,inside);
      const east = position(form,lat,theta+.002,inside), west = position(form,lat,theta-.002,inside);
      const dx=south[0]-north[0], dy=south[1]-north[1], dz=south[2]-north[2];
      const ex=east[0]-west[0], ey=east[1]-west[1], ez=east[2]-west[2];
      const nx=dy*ez-dz*ey, ny=dz*ex-dx*ez, nz=dx*ey-dy*ex;
      const norm = (inside?-1:1)/(Math.hypot(nx,ny,nz)||1);
      poses.push([...p,nx*norm,ny*norm,nz*norm]);
    }
    const cos=Math.cos(theta), sin=Math.sin(theta);
    return {poses,body:new Float64Array(6),x:0,y:0,z:0,u,v,light:0,
      tangent:[cos,0,-sin], frame:new Float32Array(6)};

  }

  function sectionAngle(u,phi) {
    return seam+tau*u + .28*Math.cos(phi+.32)*Math.cos(tau*u) + .12*Math.cos(2*phi-.4);
  }
  for (let col=0;col<=longitudes;col++) {
    const u=col/longitudes;
    shell[col]=[]; lumen[col]=[];
    for (let row=0;row<=latitudes;row++) {
      const v=row/latitudes, theta=sectionAngle(u,v*Math.PI);
      shell[col].push(surfaceVertex(v*Math.PI,theta,false,u,v));
      lumen[col].push(surfaceVertex(v*Math.PI,theta,true,u,v));
    }
  }
  for (const wall of walls) {
    for (let row=0;row<=latitudes;row++) wall.push(wallBands.map(()=>({})));
  }
  const budTips=buds.map(bud=>{
    const row=Math.round(Math.acos(bud.y)*latitudes/Math.PI);
    let best=0, score=-Infinity;
    for (let col=0;col<longitudes;col++) {
      const angle=sectionAngle(col/longitudes,row*Math.PI/latitudes);
      const alignment=bud.x*Math.sin(angle)+bud.z*Math.cos(angle);
      if (alignment>score) { best=col; score=alignment; }
    }
    return {col:best,row};
  });

  // Each instance is composited from a tightly cropped tile, with its own depth buffer.
  function draw(ctx,{x,y,radius,yaw,pitch,weights,opening,detail=1,showNotes=false,form=0}) {
    if (radius<1) return [];
    const poseDirty = detail!==lastDetail || weights.some((value,i)=>value!==lastWeights[i]);
    lastWeights=weights; lastDetail=detail;
    const gap = Math.round(longitudes*.282*opening);
    const size=32*Math.ceil(radius*2.8/32);
    const density = renderer.begin(size,size,ctx.getTransform().a,detail);
    const scale = radius*density, cx=size*.5*density, cy=cx;
    const cosY=Math.cos(yaw), sinY=Math.sin(yaw), cosP=Math.cos(pitch), sinP=Math.sin(pitch);
    const roll=-.22, cr=Math.cos(roll), sr=Math.sin(roll);
    const xx=cr*cosY+sr*sinP*sinY, xy=-sr*cosP, xz=-cr*sinY+sr*sinP*cosY;
    const yx=sr*cosY-cr*sinP*sinY, yy=cr*cosP, yz=-sr*sinY-cr*sinP*cosY;
    const zx=cosP*sinY, zy=sinP, zz=cosP*cosY;
    const lx=-.52*xx+.68*yx+.50*zx, ly=-.52*xy+.68*yy+.50*zy, lz=-.52*xz+.68*yz+.50*zz;
    const hx=-.30*xx+.39*yx+.87*zx, hy=-.30*xy+.39*yy+.87*zy, hz=-.30*xz+.39*yz+.87*zz;
    function project(v,inside,edgeDistance) {
      const p=v.body;
      if (poseDirty) {
        p.fill(0);
        for (let j=0;j<4;j++) {
          if (!weights[j]) continue;
          const pose=v.poses[j];
          for (let axis=0;axis<6;axis++) p[axis]+=pose[axis]*weights[j];
        }
        const normalLength=Math.hypot(p[3],p[4],p[5]) || 1;
        for (let axis=3;axis<6;axis++) p[axis]/=normalLength;
        const relief=detail*renderer.relief(v.u,v.v)*(inside?-.24*(weights[2]+weights[3]):1);
        for (let axis=0;axis<3;axis++) p[axis]+=relief*p[axis+3];
        // Project the texture axes onto the posed surface, including the shoulders of buds.
        const dot=v.tangent[0]*p[3]+v.tangent[2]*p[5], f=v.frame;
        const tx=v.tangent[0]-dot*p[3], ty=-dot*p[4], tz=v.tangent[2]-dot*p[5];
        const inv=1/(Math.hypot(tx,ty,tz)||1), sign=inside?-1:1;
        f[0]=tx*inv; f[1]=ty*inv; f[2]=tz*inv;
        f[3]=sign*(f[1]*p[5]-f[2]*p[4]);
        f[4]=sign*(f[2]*p[3]-f[0]*p[5]);
        f[5]=sign*(f[0]*p[4]-f[1]*p[3]);
      }
      const px=p[0]*xx+p[1]*xy+p[2]*xz, py=p[0]*yx+p[1]*yy+p[2]*yz;
      v.x=cx+scale*px; v.y=cy-scale*py; v.z=p[0]*zx+p[1]*zy+p[2]*zz;
      const nx=p[3]*xx+p[4]*xy+p[5]*xz, ny=p[3]*yx+p[4]*yy+p[5]*yz, nz=p[3]*zx+p[4]*zy+p[5]*zz;
      const key = Math.max(0,-.52*nx+.68*ny+.50*nz);
      const rim = (1-Math.min(1,Math.abs(nz)))**2;
      const f=v.frame;
      const tu=f[0]*lx+f[1]*ly+f[2]*lz, tv=f[3]*lx+f[4]*ly+f[5]*lz;
      if (inside) {
        const reach=Math.max(0,1-edgeDistance*Math.hypot(p[0],p[2])*1.15);
        v.light=.043+.42*key+.30*Math.max(0,-py)+.11*Math.max(0,px)+.19*reach*reach;
        v.lightU=-.065*tu; v.lightV=-.065*tv;
      } else {
        const half=Math.max(0,-.30*nx+.39*ny+.87*nz);
        const gloss=half**18, diffuse=.18+.56*Math.min(1,3*key);
        const specSlope=1.65*gloss;
        v.light=.11+.73*key+.25*gloss+.16*rim*(.68+ny*.32)+.10*Math.max(0,-px);
        v.lightU=detail*(diffuse*tu+specSlope*(f[0]*hx+f[1]*hy+f[2]*hz));
        v.lightV=detail*(diffuse*tv+specSlope*(f[3]*hx+f[4]*hy+f[5]*hz));
      }
    }
    const hasLumen=weights[2]+weights[3]>.0001;
    // Keep hidden columns posed during a morph; they can be revealed mid-transition.
    let left=Infinity,right=-Infinity,bottom=-Infinity;
    for (let col=0;col<=longitudes;col++) {
      if (!poseDirty && col>0 && col<gap) continue;
      const edgeDistance=tau*Math.max(0,Math.min(col-gap,longitudes-col))/longitudes;
      for(let row=0;row<=latitudes;row++) {
        const outer=shell[col][row];
        project(outer,false,0);
        if (col===0 || col>=gap) {
          left=Math.min(left,outer.x); right=Math.max(right,outer.x); bottom=Math.max(bottom,outer.y);
        }
        if (gap || poseDirty) project(lumen[col][row],true,edgeDistance);
      }
    }
    for (let col=gap;col<longitudes;col++) {
      for (let j=0;j<latitudes;j++) {
        const a=shell[col][j], b=shell[col+1][j], c=shell[col+1][j+1], d=shell[col][j+1];
        renderer.triangle(a,b,c,skin); renderer.triangle(a,c,d,skin);
      }
    }
    if (gap) {
      const hollow=weights[2]+weights[3];
      for (let side=0;side<2;side++) {
        const col=side?gap:0, wall=walls[side];
        const sign=side?-1:1;
        for(let j=0;j<=latitudes;j++) {
          const outer=shell[col][j].body, inner=lumen[col][j].body;
          const rx=outer[0]-inner[0], ry=outer[1]-inner[1], rz=outer[2]-inner[2];
          const thickness=Math.hypot(rx,ry,rz)||.001;
          const prev=shell[col][Math.max(0,j-1)].body, next=shell[col][Math.min(latitudes,j+1)].body;
          const sx=next[0]-prev[0], sy=next[1]-prev[1], sz=next[2]-prev[2];
          const nx=ry*sz-rz*sy, ny=rz*sx-rx*sz, nz=rx*sy-ry*sx;
          const inv=sign/(Math.hypot(nx,ny,nz)||1);
          const faceLight=(nx*lx+ny*ly+nz*lz)*inv;
          const radialLight=(rx*lx+ry*ly+rz*lz)/thickness;
          const bevel=Math.min(.014,.065*thickness,Math.hypot(outer[0],outer[2])*.15);
          for(let k=0;k<wallBands.length;k++) {
            const t=wallBands[k], w=wall[j][k];
            const inward=Math.max(0,1-t/.12), outward=Math.max(0,1-(1-t)/.12);
            const profile=1-inward*inward-outward*outward;
            const lift=bevel*profile*(hollow+(1-hollow)*t);
            const x=inner[0]+rx*t+nx*inv*lift, y=inner[1]+ry*t+ny*inv*lift, z=inner[2]+rz*t+nz*inv*lift;
            const slope=bevel*(2/.12)*(inward*hollow-outward)/thickness;
            const light=(faceLight-slope*radialLight)/Math.sqrt(1+slope*slope);
            w.x=cx+scale*(x*xx+y*xy+z*xz); w.y=cy-scale*(x*yx+y*yy+z*yz); w.z=x*zx+y*zy+z*zz;
            w.light=.44+.42*Math.max(0,light)+.12*y+.08*t+.14*outward+.09*inward*hollow;
            // Both exposed planes meet on the same tissue sample at the central axis.
            w.u=Math.max(0,Math.min(1,.5+sign*.38*Math.hypot(x,z)));
            w.v=Math.max(0,Math.min(.999,.50-.40*y));
            w.layerU=j/latitudes; w.layerV=t;
          }
        }
        for(let j=0;j<latitudes;j++) {
          for(let k=0;k<wallBands.length-1;k++) {
            const a=wall[j][k], b=wall[j][k+1], c=wall[j+1][k+1], d=wall[j+1][k];
            renderer.triangle(a,b,c,tissue,weights[2]); renderer.triangle(a,c,d,tissue,weights[2]);
          }
        }
      }
      // The opaque shell and cut faces can reject hidden lining pixels before sampling.
      if (hasLumen) {
        for (let col=gap;col<longitudes;col++) {
          for (let j=0;j<latitudes;j++) {
            const e=lumen[col][j], f=lumen[col+1][j], g=lumen[col+1][j+1], h=lumen[col][j+1];
            renderer.triangle(e,g,f,cavity); renderer.triangle(e,h,g,cavity);
          }
        }
      }
    }
    // Keep the contact shadow close to the silhouette, even for a flattened specimen.
    const diameter=(right-left)/density;
    const tileX=x-size/2, tileY=y-size/2;
    ctx.save();
    ctx.translate(tileX+(left+right)/(2*density),tileY+bottom/density+diameter*.014);
    ctx.scale(Math.max(1,diameter*.55),Math.max(1,diameter*.040));
    const shade=ctx.createRadialGradient(0,0,0,0,0,1);
    shade.addColorStop(0,'rgba(47,68,105,.23)'); shade.addColorStop(1,'rgba(47,68,105,0)');
    ctx.fillStyle=shade; ctx.fillRect(-1,-1,2,2);
    ctx.restore();
    renderer.present(ctx,tileX,tileY,size);

    // Resolve the nearest actually visible pixel of a feature, even after a turn.
    if (!showNotes) return [];
    const halfway=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    const wallTip=walls[1][Math.round(latitudes*.30)][Math.floor(wallBands.length/2)];
    const side=gap>0?gap:0;
    const mouth=halfway(lumen[0][latitudes/2],lumen[side][latitudes/2]);
    const body={x:cx+scale*.46,y:cy-scale*.12};
    let anchors;
    if (form===1) {
      const tips=budTips.filter(tip=>!gap || tip.col>=gap).map(tip=>shell[tip.col][tip.row]);
      const bud=tips.sort((a,b)=>b.z-a.z)[0];
      anchors=[renderer.pick({x:cx+scale*.30,y:cy-scale*.58},skin),renderer.pick(bud,skin)];
    } else if (!gap) {
      anchors=[renderer.pick({x:cx+scale*.48,y:cy-scale*.33},skin)];
    } else if (form===0) {
      anchors=[renderer.pick({x:cx+scale*.18,y:cy-scale*.85},skin),renderer.pick(body,tissue)];
    } else {
      anchors=[renderer.pick(wallTip,tissue),renderer.pick(mouth,cavity)];
    }
    return anchors.map(p=>({x:tileX+p.x/density,y:tileY+p.y/density,visible:p.visible}));
  }
  return {draw};
}

// A depth buffer and interpolated lighting let the same material follow the mesh
// during rotation, including in browsers without a hardware-accelerated 3D context.
let organoidPigments;
function createTissuePainter(onReady) {
  const buffer=document.createElement('canvas'), ctx=buffer.getContext('2d');
  let w=0,h=0,bitmap,depth,features,textureDetail=1;
  let atlas, texWidth, stride, skinRows, wallRows, wallTop, solidTop, lumenTop, normalTop;
  function useMaterial(sheet) {
    atlas=sheet.data; texWidth=sheet.width; stride=texWidth*4;
    skinRows=texWidth/2; wallRows=texWidth/8;
    wallTop=skinRows; solidTop=wallTop+wallRows;
    lumenTop=solidTop+skinRows; normalTop=lumenTop+skinRows;
  }
  if (organoidPigments) useMaterial(organoidPigments);
  else {
    const image=new Image();
    image.onload=()=>{
      const sheet=document.createElement('canvas');
      sheet.width=image.width; sheet.height=image.height;
      const ink=sheet.getContext('2d');
      ink.drawImage(image,0,0);
      organoidPigments=ink.getImageData(0,0,sheet.width,sheet.height);
      useMaterial(organoidPigments);
      onReady();
    };
    image.src='assets/organoid-material.jpg';
  }
  const base=[[119,139,192],[67,100,147],[147,198,205]];
  function relief(u,v) {
    if (!atlas) return 0;
    const texel=(normalTop+Math.round(v*(skinRows-1)))*stride+Math.round(u*(texWidth-1))*4;
    return (atlas[texel+2]-64)/5000;
  }

  function begin(width,height,pixelRatio,detail) {
    textureDetail=detail;
    const density=Math.min(Math.max(1.35,pixelRatio),1.75,1280/width,1010/height);
    const nextW=Math.max(1,Math.round(width*density)), nextH=Math.max(1,Math.round(height*density));
    if(w!==nextW || h!==nextH) {
      w=buffer.width=nextW; h=buffer.height=nextH;
      bitmap=ctx.createImageData(w,h);
      depth=new Float32Array(w*h); features=new Uint8Array(w*h);
    }
    bitmap.data.fill(0); depth.fill(-Infinity); features.fill(255);
    return density;
  }

  // Bilinear colour between texel centres, clamped to the current atlas strip.
  function sample(index,fx,fy) {
    const next=index+stride;
    const wa=(1-fx)*(1-fy), wb=fx*(1-fy), wc=(1-fx)*fy, wd=fx*fy;
    const r=atlas[index]*wa+atlas[index+4]*wb+atlas[next]*wc+atlas[next+4]*wd;
    const g=atlas[index+1]*wa+atlas[index+5]*wb+atlas[next+1]*wc+atlas[next+5]*wd;
    const b=atlas[index+2]*wa+atlas[index+6]*wb+atlas[next+2]*wc+atlas[next+6]*wd;
    return (r<<16)|(g<<8)|b;
  }

  function triangle(a,b,c,material,layer=0) {
    const abx=b.x-a.x, aby=b.y-a.y, acx=c.x-a.x, acy=c.y-a.y;
    const area=abx*acy-aby*acx;
    if (Math.abs(area)<.00001 || (area<0 && material!==2)) return;
    const x0=Math.max(0,Math.ceil(Math.min(a.x,b.x,c.x)-.5)), x1=Math.min(w-1,Math.floor(Math.max(a.x,b.x,c.x)-.5));
    const y0=Math.max(0,Math.ceil(Math.min(a.y,b.y,c.y)-.5)), y1=Math.min(h-1,Math.floor(Math.max(a.y,b.y,c.y)-.5));
    const ux=acy/area, uy=-acx/area, vx=-aby/area, vy=abx/area;
    const dz1=b.z-a.z,dz2=c.z-a.z,dl1=b.light-a.light,dl2=c.light-a.light;
    const epithelial=material===2 && layer>=1;
    const blend=material===2 && layer>0 && layer<1;
    const au=epithelial?a.layerU:a.u, av=epithelial?a.layerV:a.v;
    const du1=(epithelial?b.layerU:b.u)-au, du2=(epithelial?c.layerU:c.u)-au;
    const dv1=(epithelial?b.layerV:b.v)-av, dv2=(epithelial?c.layerV:c.v)-av;
    const top=material===0?0:material===1?lumenTop:epithelial?wallTop:solidTop;
    const maxU=texWidth-1.00001, maxV=(epithelial?wallRows:skinRows)-1.00001;
    const data=bitmap.data, pigment=base[material];
    const bump=material!==2 && atlas, normalOffset=(normalTop-top)*stride;
    const bu=bump?a.lightU:0, bv=bump?a.lightV:0;
    const duLight=bump?b.lightU-bu:0, dvLight=bump?c.lightU-bu:0;
    const duMeridian=bump?b.lightV-bv:0, dvMeridian=bump?c.lightV-bv:0;
    for(let y=y0;y<=y1;y++) {
      let s=(x0+.5-a.x)*ux+(y+.5-a.y)*uy, t=(x0+.5-a.x)*vx+(y+.5-a.y)*vy;
      for(let x=x0;x<=x1;x++,s+=ux,t+=vx) {
        if (s<-.00001 || t<-.00001 || s+t>1.00001) continue;
        const index=y*w+x, z=a.z+s*dz1+t*dz2;
        if (z<depth[index]) continue;
        depth[index]=z; features[index]=material;
        let light=a.light+s*dl1+t*dl2;
        const dest=index*4;
        let red=pigment[0], green=pigment[1], blue=pigment[2];
        if (atlas) {
          const u=Math.max(0,Math.min(maxU,(au+s*du1+t*du2)*maxU));
          const v=Math.max(0,Math.min(maxV,(av+s*dv1+t*dv2)*maxV));
          const iu=u|0, iv=v|0, fx=u-iu, fy=v-iv, texel=(top+iv)*stride+iu*4;
          const rgb=sample(texel,fx,fy);
          red=rgb>>>16; green=(rgb>>>8)&255; blue=rgb&255;
          if (textureDetail<1) {
            red=pigment[0]+(red-pigment[0])*textureDetail;
            green=pigment[1]+(green-pigment[1])*textureDetail;
            blue=pigment[2]+(blue-pigment[2])*textureDetail;
          }
          if (bump) {
            const normal=texel+normalOffset+(fx>=.5?4:0)+(fy>=.5?stride:0);
            const perturb=(atlas[normal]-128)*(bu+s*duLight+t*dvLight)+(atlas[normal+1]-128)*(bv+s*duMeridian+t*dvMeridian);
            light+=.0032*perturb;
          } else if (blend) {
            const lu=Math.max(0,Math.min(maxU,(a.layerU+s*(b.layerU-a.layerU)+t*(c.layerU-a.layerU))*maxU));
            const lv=Math.max(0,Math.min(wallRows-1.00001,(a.layerV+s*(b.layerV-a.layerV)+t*(c.layerV-a.layerV))*(wallRows-1.00001)));
            const layerRGB=sample((wallTop+(lv|0))*stride+(lu|0)*4,lu-(lu|0),lv-(lv|0));
            red+=((layerRGB>>>16)-red)*layer;
            green+=(((layerRGB>>>8)&255)-green)*layer;
            blue+=((layerRGB&255)-blue)*layer;
          }
        }
        data[dest]=red*(.29+.98*light)+8*light;
        data[dest+1]=green*(.27+.96*light)+8*light;
        data[dest+2]=blue*(.35+.79*light)+9;
        data[dest+3]=255;
      }
    }
  }

  function pick(point,material) {
    if (!Number.isFinite(point.x+point.y)) return {x:0,y:0,visible:false};
    const x0=Math.max(1,Math.min(w-2,Math.round(point.x))), y0=Math.max(1,Math.min(h-2,Math.round(point.y)));
    // Expanding square rings avoid searching the whole plate for an occluded point.
    function match(x,y) {
      if (x<1 || y<1 || x>=w-1 || y>=h-1) return false;
      const i=y*w+x;
      return features[i]===material && features[i-1]===material && features[i+w]===material;
    }
    for(let r=0;r<Math.max(w,h)*.34;r+=2) {
      for(let d=-r;d<=r;d+=2) {
        if(match(x0+d,y0-r)) return {x:x0+d,y:y0-r,visible:true};
        if(match(x0+d,y0+r)) return {x:x0+d,y:y0+r,visible:true};
        if(match(x0-r,y0+d)) return {x:x0-r,y:y0+d,visible:true};
        if(match(x0+r,y0+d)) return {x:x0+r,y:y0+d,visible:true};
      }
    }
    return {x:x0,y:y0,visible:false};
  }
  function present(target,x,y,size) {
    ctx.putImageData(bitmap,0,0);
    target.drawImage(buffer,x,y,size,size);
  }
  return {begin,triangle,pick,present,relief};
}
