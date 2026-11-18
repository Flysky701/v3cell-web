"""Bake the three illustrative tissue surfaces and their relief for the rotating specimen.

Artwork only. These textures are independent of all manuscript images.
"""
from pathlib import Path

import numpy as np
from PIL import Image


WIDTH = 1536
HEIGHT = WIDTH // 2
rng = np.random.default_rng(713)
u = (np.arange(WIDTH, dtype=np.float32) + .5) / WIDTH


def mix(a, b, amount):
    return a + (b - a) * amount[..., None]


def tint(rgb, tone):
    return np.asarray(rgb) + tone[..., None]


def noise(x, y, z, frequency, grid):
    """Continuous 3-D noise, including across the texture seam and at the poles."""
    axis = [p * frequency for p in (x, y, z)]
    index = [np.floor(p).astype(np.int32) for p in axis]
    blend = [p - i for p, i in zip(axis, index)]
    blend = [f * f * (3 - 2*f) for f in blend]
    size = grid.shape[0]
    result = 0
    for k in (0, 1):
        for j in (0, 1):
            for i in (0, 1):
                sample = grid[(index[0]+i) % size, (index[1]+j) % size, (index[2]+k) % size]
                result += sample * (blend[0] if i else 1-blend[0]) * (blend[1] if j else 1-blend[1]) * (blend[2] if k else 1-blend[2])
    return result


def skin_and_lining():
    lon, lat = np.meshgrid(2*np.pi*u, np.pi*(np.arange(HEIGHT, dtype=np.float32)+.5)/HEIGHT)
    x, y, z = np.sin(lat)*np.sin(lon), np.cos(lat), np.sin(lat)*np.cos(lon)
    grain = rng.uniform(-1, 1, (43, 43, 43)).astype('float32')
    cloud = noise(x, y, z, 5, grain)
    mottling = noise(x, y, z, 26, grain)
    fine = noise(x, y, z, 95, grain)
    # Shallow streaks on the inward face follow larger folds in the wall.
    flow = 10*x+6*y-8*z+1.8*np.sin(5*z+2*x)+.75*np.sin(7*y-3*x)
    flutes = (np.cos(flow)+.32*np.cos(2*flow+.3))*(.6+.35*np.sin(4*y-5*z))
    xyz = np.stack([x+.024*np.sin(13*y+7*z)+.006*np.sin(33*z-7*x),
                    y+.024*np.sin(11*z-9*x)+.007*np.cos(25*x+18*y),
                    z+.027*np.sin(13*x+9*y)+.007*np.sin(24*y-17*z)], axis=-1)
    xyz /= np.linalg.norm(xyz, axis=-1, keepdims=True)

    count = 560
    i = np.arange(count)
    h = 1 - 2*(i+.5)/count
    angle = i*np.pi*(3-np.sqrt(5))
    seeds = np.stack([np.sqrt(1-h*h)*np.sin(angle), h, np.sqrt(1-h*h)*np.cos(angle)], axis=-1)
    seeds += rng.normal(0, .032, seeds.shape)
    seeds /= np.linalg.norm(seeds, axis=-1, keepdims=True)
    seeds = seeds.astype('float32')
    tangent = np.cross(seeds, np.array([0, 1, 0]))
    tangent /= np.linalg.norm(tangent, axis=-1, keepdims=True)
    bitangent = np.cross(seeds, tangent)
    twist = rng.uniform(0, 2*np.pi, count)[:, None]
    major = tangent*np.cos(twist) + bitangent*np.sin(twist)
    minor = bitangent*np.cos(twist) - tangent*np.sin(twist)
    width = rng.uniform(.024, .044, count)
    aspect = rng.uniform(.57, .85, count)
    offset = rng.uniform(-.023, .023, (count, 2))
    depth = rng.uniform(.08, .78, count)**1.15
    shade = rng.normal(0, 3, count)
    hue = rng.uniform(-1, 1, count)
    height = np.empty_like(x)
    surface = np.empty((*x.shape, 3), dtype=np.float32)
    lining = np.empty_like(surface)
    for start in range(0, HEIGHT, 8):
        rows = slice(start, start+8)
        points = xyz[rows].reshape(-1, 3)
        dots = points @ seeds.T
        cell = dots.argmax(axis=1)
        n = np.arange(cell.size)
        closest = dots[n, cell].copy()
        dots[n, cell] = -2
        neighbor = dots.argmax(axis=1)
        gap = (closest-dots[n, neighbor]) / np.linalg.norm(seeds[cell]-seeds[neighbor], axis=1)
        delta = points-seeds[cell]
        a = ((delta*major[cell]).sum(axis=1)-offset[cell, 0])/width[cell]
        b = ((delta*minor[cell]).sum(axis=1)-offset[cell, 1])/(width[cell]*aspect[cell])
        radius = np.sqrt((a+.09*np.sin(2.5*b))**2 + b*b)
        junction = np.exp(-(gap/.0055)**2)
        shoulder = 1 - np.exp(-gap/.030)
        # Taper the visible ovoids into the cytoplasm; their depth varies by cell.
        body = np.exp(-.86*radius**4) * depth[cell] * (1-np.exp(-gap/.010))
        inner = np.exp(-((a-.19)**2+(b+.16)**2)/.080)
        f = fine[rows].ravel()
        m = mottling[rows].ravel()
        c = cloud[rows].ravel()
        height[rows] = (.011*shoulder - .0015*junction + .002*np.exp(-radius**2)
                        + .0022*m + .0015*c).reshape(-1, WIDTH)
        tone = shade[cell] + 9*c + 6*m + 3*f + 6*shoulder - 10*junction
        tissue = tint((124, 147, 193), tone) + hue[cell, None]*[5, -.8, 2.5]
        tissue = mix(tissue, tint((75, 99, 153), 9*m+8*f-26*inner), body)
        tissue += np.exp(-((radius-1.08)/.23)**2)[:, None]*depth[cell, None]*[4, 6, 8]
        surface[rows] = tissue.reshape(-1, WIDTH, 3)
        # Lower contrast on the inward-facing surface keeps the lumen readable at a glance.
        lining[rows] = tint((81, 115, 159), 8*c+6*m+3*f+shade[cell]*.24+
                            10*flutes[rows].ravel()+3*shoulder-4*junction-3*body).reshape(-1, WIDTH, 3)

    d_lon = (np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*WIDTH/(4*np.pi*np.maximum(.025,np.sin(lat)))
    d_lat = np.gradient(height,axis=0)*HEIGHT/np.pi
    normals = np.stack([128-175*d_lon,128-175*d_lat,64+height*5000],axis=-1)
    return surface, lining, normals


def section_nuclei(tissue, a, b, strength, grain):
    """An eccentric nuclear profile with a soft envelope and fine internal contrast."""
    r = np.sqrt((a+.065*np.sin(3*b))**2 + b*b)
    fill = np.clip((1.10-r)/.38, 0, 1)
    fill = fill*fill*(3-2*fill)
    core = np.exp(-((a-.27)**2+(b+.12)**2)/.064)
    edge = np.exp(-((r-.82)/.19)**2)
    profile = tint((77, 113, 152), 7*grain-20*core-9*edge)
    return mix(tissue, profile, strength*fill)


def wall():
    # Along the opening, the long axis of each profile runs across the wall.
    a, b = np.meshgrid(u*25, (np.arange(HEIGHT//4)+.5)/(HEIGHT//4))
    p = a+.18*np.sin(1.41*a)+.08*np.sin(2.2*a+3*b)+.12*(b-.5)*np.cos(2*a)
    cell = np.floor(p).astype(int)
    f = p % 1
    d = np.minimum(f, 1-f)
    fibre = np.sin(28*p+6*b+2*np.sin(9*b+p)) + .7*np.cos(43*p-5*b)
    grain = rng.normal(0, 1, p.shape)
    tone = (5*np.cos(cell*8.1)+3*fibre+1.5*grain+7*np.sin(np.pi*b)
            -21*np.exp(-(d/.037)**2)+8*np.exp(-((d-.07)/.055)**2)
            +19*np.exp(-((b-.035)/.024)**2)-10*np.exp(-((b-.087)/.029)**2)
            +15*np.exp(-((b-.969)/.032)**2))
    tissue = tint((144, 193, 203), tone)
    a = (f-.50-.115*np.sin(cell*4.6) + .13*(b-.50)*np.cos(cell*5.9))/(.18+.045*np.cos(4.3*cell))
    n = (b-.49-.13*np.cos(cell*8.1))/(.18+.035*np.sin(cell*8.3))
    tissue = section_nuclei(tissue, a, n, .58+.28*np.sin(cell*4.9), .35*grain+fibre)
    return tissue


def solid():
    a, b = np.meshgrid(u*14, (np.arange(HEIGHT)+.5)/HEIGHT*25)
    a += .16*np.sin(1.9*b+.6*a)+.048*np.cos(4.5*a-2*b)
    b += .13*np.sin(1.6*a+b)+.035*np.sin(4*b+3*a)
    ix, iy = np.floor(a).astype(int), np.floor(b).astype(int)
    best = np.full_like(a, 12)
    second = best.copy()
    ids = rng.uniform(0, 1, (31, 21, 7))
    winner = np.zeros_like(ix)
    dx, dy = np.zeros_like(a), np.zeros_like(b)
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            cell = ids[iy+j+2, ix+i+2]
            x = a-(ix+i+.12+.76*cell[..., 0])
            y = b-(iy+j+.12+.76*cell[..., 1])
            ds = x*x + y*y
            closer = ds < best
            second = np.minimum(second, np.where(closer, best, ds))
            best = np.minimum(best, ds)
            winner = np.where(closer, (iy+j+2)*ids.shape[1]+ix+i+2, winner)
            dx = np.where(closer, x, dx)
            dy = np.where(closer, y, dy)
    cell = ids.reshape(-1, 7)[winner]
    gap = np.sqrt(second)-np.sqrt(best)
    grain = rng.normal(0, 1, a.shape)
    fibre = np.sin(13*a+4*b+2*np.sin(5*b))+np.cos(8*b-5*a)
    tone = (12*(cell[..., 2]-.5) - 19*np.exp(-(gap/.050)**2) +
            6*np.exp(-((gap-.105)/.07)**2) + 2*fibre+1.5*grain +
            5*np.sin(.8*a+.6*b)*np.cos(.57*b))
    tissue = tint((138, 184, 199), tone)
    angle = cell[..., 3]*np.pi
    dx += .19*(cell[..., 4]-.5)
    dy += .16*(cell[..., 3]-.5)
    major = (dx*np.cos(angle)+dy*np.sin(angle))/(.16+.16*cell[..., 5])
    minor = (dy*np.cos(angle)-dx*np.sin(angle))/(.095+.10*cell[..., 4])
    strength = (.24+.62*cell[..., 6]) * np.clip(gap/.09, 0, 1)
    return section_nuclei(tissue, major, minor, strength, .4*grain+fibre)


surface, lining, normals = skin_and_lining()
# Heights in units of WIDTH: skin 1/2, wall 1/8, solid 1/2, lining 1/2, normals 1/2.
atlas = np.concatenate([surface, wall(), solid(), lining, normals]).clip(0,255).astype('uint8')
dest = Path(__file__).resolve().parents[1]/'dist'/'assets'/'organoid-material.jpg'
Image.fromarray(atlas).save(dest, quality=92, subsampling=0, optimize=True)
