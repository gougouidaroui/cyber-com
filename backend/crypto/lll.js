function dotProduct(v1, v2) {
  return v1.reduce((sum, val, i) => sum + val * v2[i], 0);
}

function vectorNorm(v) {
  return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
}

function gramSchmidt(vectors) {
  const ortho = [];
  const u = [];

  for (let i = 0; i < vectors.length; i++) {
    let v = [...vectors[i]];

    for (let j = 0; j < i; j++) {
      const proj = dotProduct(vectors[i], u[j]) / dotProduct(u[j], u[j]);
      v = v.map((val, k) => val - proj * u[j][k]);
    }

    u.push(v);
    ortho.push(v);
  }

  return { ortho, u };
}

function lll(matrix, delta = 0.75) {
  const k = matrix.length;
  let basis = matrix.map(row => [...row]);

  function sizeReducer() {
    for (let i = 1; i < k; i++) {
      for (let j = i - 1; j >= 0; j--) {
        const mu = Math.round(dotProduct(basis[i], basis[j]) / dotProduct(basis[j], basis[j]));
        if (mu !== 0) {
          basis[i] = basis[i].map((val, idx) => val - mu * basis[j][idx]);
        }
      }
    }
  }

  sizeReducer();

  let changed = true;
  while (changed) {
    changed = false;

    for (let i = 0; i < k; i++) {
      for (let j = i - 1; j >= 0; j--) {
        const bi = basis[i];
        const bj = basis[j];

        const biNormSq = dotProduct(bi, bi);
        const bjNormSq = dotProduct(bj, bj);

        if (bjNormSq === 0) continue;

        const mu = dotProduct(bi, bj) / bjNormSq;

        if (2 * mu * mu >= 1) {
          const q = Math.round(mu);
          if (q !== 0) {
            basis[i] = basis[i].map((val, idx) => val - q * bj[idx]);
            changed = true;
          }
        }
      }
    }

    sizeReducer();

    for (let i = 1; i < k; i++) {
      const b_i_1 = basis[i - 1];
      const b_i = basis[i];

      const norm1Sq = dotProduct(b_i_1, b_i_1);
      const norm2Sq = dotProduct(b_i, b_i);

      if (norm1Sq === 0) continue;

      const mu = dotProduct(b_i, b_i_1) / norm1Sq;

      if (norm2Sq < (delta - mu * mu) * norm1Sq) {
        const temp = basis[i];
        basis[i] = [...b_i_1];
        basis[i - 1] = temp;
        changed = true;
        break;
      }
    }
  }

  return basis;
}

module.exports = { lll, dotProduct, vectorNorm, GramSchmidt: gramSchmidt };