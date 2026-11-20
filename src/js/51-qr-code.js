    // ---------- QR code (invitation au foyer) : encodeur compact, mode octets, correction M ----------
    function qrMatrix(text){
      var ECC=[-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26], NB=[-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16];
      var data=[], u=unescape(encodeURIComponent(text)), i, j;
      for(i=0;i<u.length;i++) data.push(u.charCodeAt(i));
      function rawMods(v){ var r=(16*v+128)*v+64; if(v>=2){ var n=Math.floor(v/7)+2; r-=(25*n-10)*n-55; if(v>=7) r-=36; } return r; }
      function cap(v){ return Math.floor(rawMods(v)/8)-ECC[v]*NB[v]; }
      var ver=1; while(ver<=20 && (4+(ver<10?8:16)+data.length*8) > cap(ver)*8) ver++;
      if(ver>20) throw new Error("texte trop long");
      var bits=[]; function put(val,len){ for(var k=len-1;k>=0;k--) bits.push((val>>>k)&1); }
      put(4,4); put(data.length, ver<10?8:16); data.forEach(function(b){ put(b,8); });
      var cbits=cap(ver)*8; put(0, Math.min(4, cbits-bits.length)); put(0, (8-bits.length%8)%8);
      for(var pad=0xEC; bits.length<cbits; pad^=0xEC^0x11) put(pad,8);
      var cw=[]; for(i=0;i<bits.length;i+=8){ var b=0; for(j=0;j<8;j++) b=(b<<1)|bits[i+j]; cw.push(b); }
      function mul(x,y){ var z=0; for(var k=7;k>=0;k--){ z=(z<<1)^((z>>>7)*0x11D); z^=((y>>>k)&1)*x; } return z; }
      var deg=ECC[ver], div=[]; for(i=0;i<deg-1;i++) div.push(0); div.push(1);
      var root=1; for(i=0;i<deg;i++){ for(j=0;j<deg;j++){ div[j]=mul(div[j],root); if(j+1<deg) div[j]^=div[j+1]; } root=mul(root,2); }
      function rem(d){ var r=div.map(function(){ return 0; }); d.forEach(function(b){ var f=b^r.shift(); r.push(0); for(var k=0;k<r.length;k++) r[k]^=mul(div[k],f); }); return r; }
      var nb=NB[ver], raw=Math.floor(rawMods(ver)/8), nShort=nb-raw%nb, shortLen=Math.floor(raw/nb), blocks=[], k=0;
      for(i=0;i<nb;i++){ var dl=shortLen-deg+(i<nShort?0:1), d=cw.slice(k,k+dl); k+=dl; var e=rem(d); if(i<nShort) d.push(0); blocks.push(d.concat(e)); }
      var all=[]; for(i=0;i<blocks[0].length;i++) for(j=0;j<nb;j++) if(i!==shortLen-deg || j>=nShort) all.push(blocks[j][i]);
      var n=ver*4+17, M=[], F=[]; for(i=0;i<n;i++){ M.push([]); F.push([]); for(j=0;j<n;j++){ M[i].push(false); F[i].push(false); } }
      function fn(x,y,dark){ M[y][x]=dark; F[y][x]=true; }
      for(i=0;i<n;i++){ fn(6,i,i%2===0); fn(i,6,i%2===0); }
      function finder(x,y){ for(var dy=-4;dy<=4;dy++) for(var dx=-4;dx<=4;dx++){ var dd=Math.max(Math.abs(dx),Math.abs(dy)), xx=x+dx, yy=y+dy; if(xx>=0&&xx<n&&yy>=0&&yy<n) fn(xx,yy,dd!==2&&dd!==4); } }
      finder(3,3); finder(n-4,3); finder(3,n-4);
      var al=[]; if(ver>1){ var na=Math.floor(ver/7)+2, step=Math.ceil((ver*4+4)/(na*2-2))*2; al=[6]; for(var pos=n-7; al.length<na; pos-=step) al.splice(1,0,pos); }
      for(i=0;i<al.length;i++) for(j=0;j<al.length;j++){ if((i===0&&j===0)||(i===0&&j===al.length-1)||(i===al.length-1&&j===0)) continue; for(var ay=-2;ay<=2;ay++) for(var ax=-2;ax<=2;ax++) fn(al[i]+ax, al[j]+ay, Math.max(Math.abs(ax),Math.abs(ay))!==1); }
      function format(mask){
        var dt=(0<<3)|mask, r=dt; for(var q=0;q<10;q++) r=(r<<1)^((r>>>9)*0x537);
        var fb=((dt<<10)|r)^0x5412; function g(q){ return ((fb>>>q)&1)!==0; }
        for(var q2=0;q2<=5;q2++) fn(8,q2,g(q2)); fn(8,7,g(6)); fn(8,8,g(7)); fn(7,8,g(8)); for(q2=9;q2<15;q2++) fn(14-q2,8,g(q2));
        for(q2=0;q2<8;q2++) fn(n-1-q2,8,g(q2)); for(q2=8;q2<15;q2++) fn(8,n-15+q2,g(q2)); fn(8,n-8,true);
      }
      format(0);
      if(ver>=7){ var vr=ver; for(i=0;i<12;i++) vr=(vr<<1)^((vr>>>11)*0x1F25); var vb=(ver<<12)|vr; for(i=0;i<18;i++){ var bt=((vb>>>i)&1)!==0, a=n-11+i%3, c=Math.floor(i/3); fn(a,c,bt); fn(c,a,bt); } }
      var bi=0; for(var right=n-1; right>=1; right-=2){ if(right===6) right=5; for(var vert=0; vert<n; vert++) for(j=0;j<2;j++){ var x=right-j, up=((right+1)&2)===0, y=up?n-1-vert:vert; if(!F[y][x] && bi<all.length*8){ M[y][x]=((all[bi>>>3]>>>(7-(bi&7)))&1)!==0; bi++; } } }
      function inv(m,x,y){ switch(m){ case 0: return (x+y)%2===0; case 1: return y%2===0; case 2: return x%3===0; case 3: return (x+y)%3===0; case 4: return (Math.floor(x/3)+Math.floor(y/2))%2===0; case 5: return x*y%2+x*y%3===0; case 6: return (x*y%2+x*y%3)%2===0; default: return ((x+y)%2+x*y%3)%2===0; } }
      function apply(m){ for(var y=0;y<n;y++) for(var x=0;x<n;x++) if(!F[y][x] && inv(m,x,y)) M[y][x]=!M[y][x]; }
      function penalty(){
        var p=0, dark=0, y, x;
        for(y=0;y<n;y++){ var run=1, runY=1; for(x=1;x<n;x++){ if(M[y][x]===M[y][x-1]){ run++; if(run===5) p+=3; else if(run>5) p++; } else run=1; if(M[x][y]===M[x-1][y]){ runY++; if(runY===5) p+=3; else if(runY>5) p++; } else runY=1; } }
        for(y=0;y<n-1;y++) for(x=0;x<n-1;x++){ var cc=M[y][x]; if(cc===M[y][x+1]&&cc===M[y+1][x]&&cc===M[y+1][x+1]) p+=3; }
        // motifs qui ressemblent aux repères des coins (1:1:3:1:1) : ils gênent la lecture
        var A=[1,0,1,1,1,0,1,0,0,0,0], B=[0,0,0,0,1,0,1,1,1,0,1];
        function at(r,c,h){ if(r<0||c<0||r>=n||c>=n) return 0; return (h?M[r][c]:M[c][r])?1:0; }
        for(y=0;y<n;y++) for(x=-4;x<n;x++) for(var hv=0;hv<2;hv++){ var okA=true, okB=true; for(var t=0;t<11;t++){ var v=at(y,x+t,hv===0); if(v!==A[t]) okA=false; if(v!==B[t]) okB=false; if(!okA&&!okB) break; } if(okA) p+=40; if(okB) p+=40; }
        for(y=0;y<n;y++) for(x=0;x<n;x++) if(M[y][x]) dark++;
        return p+Math.floor(Math.abs(dark*20-n*n*10)/(n*n))*10;
      }
      var best=0, bp=1e9;
      for(var m=0;m<8;m++){ apply(m); format(m); var pp=penalty(); if(pp<bp){ bp=pp; best=m; } apply(m); }
      apply(best); format(best);
      return M;
    }
    function qrSvg(text, px){
      var M=qrMatrix(text), n=M.length, q=4, d="";
      for(var y=0;y<n;y++) for(var x=0;x<n;x++) if(M[y][x]) d+="M"+(x+q)+" "+(y+q)+"h1v1h-1z";
      return '<svg viewBox="0 0 '+(n+2*q)+' '+(n+2*q)+'" width="'+(px||240)+'" height="'+(px||240)+'" shape-rendering="crispEdges" role="img" aria-label="QR code d\'invitation"><rect width="100%" height="100%" fill="#fff"/><path d="'+d+'" fill="#0e0f14"/></svg>';
    }
