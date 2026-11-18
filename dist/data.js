'use strict';

// Values transcribed from main_nbe.pdf. Percentages and reported gains retain the manuscript's rounding.
const study = {
  static: {
    total: 7749, size: 64, page: '§4.1 · pp. 14–15',
    lineages: {
      colon: {classes: 4, rois: 2476, hallmark: 'buds'},
      stomach: {classes: 3, rois: 897, hallmark: 'ellipticity'},
      lung: {classes: 2, rois: 4376, hallmark: 'lumenArea'}
    }
  },
  fidelity: {
    colonKid: '1.9 × 10⁻⁵ ± 1.0 × 10⁻⁶', maxFold: 2.7, negligibleD: 0.2,
    lungP: 0.033, lungD: '−0.27 ± 0.05',
    baselines: ['DiT', 'Medfusion', 'F2DGAN', 'cGAN', 'cVAE', 'LDM'],
    haralick: ['Contrast', 'Correlation', 'Homogeneity', 'Entropy', 'IMC1']
  },
  phenotyping: {
    budgets: [10, 25, 50], seeds: 5,
    // N=0 is a separate virtual-only experiment. The other two scores use 25 real images per class.
    scores: {
      colon: {virtual: 0.86, real: 65.8, augmented: 87.8, gain: 22.0},
      stomach: {virtual: 0.78, real: 59.4, augmented: 83.4, gain: 24.1},
      lung: {virtual: 0.82, real: 31.7, augmented: 76.4, gain: 44.7}
    },
    lungSD: [15.9, 1.3], page: '§2.3 · p. 8 / Fig. 4 · p. 9'
  },
  dynamic: {
    train: 245, test: 36, heldOutPerFate: 12, pixels: 256, raw: 196, frames: 25, conditioning: 6, bestIndex: 4,
    accuracy: 88.9, macroF1: 0.888, hours: [48, 56, 64, 72, 80, 88, 96],
    fates: {
      formation: {train: 28, probability: 0.705, morphometry: 0.752, metric: 'cavityArea'},
      collapse: {train: 106, probability: 0.912, morphometry: 0.913, metric: 'irregularity'},
      noncavity: {train: 111, probability: 0.929, morphometry: 0.991, metric: 'organoidArea'}
    }
  },
  attribution: {
    videos: 51, trainingEhdpp: 28, heldOutEhdpp: 3, iddpp: 10, rgd: 10,
    conditions: {ehdpp: 10, iddpp: 10, rgd: 1},
    channels: ['brightfield', 'gradcam', 'pmlc', 'dapi']
  }
};
